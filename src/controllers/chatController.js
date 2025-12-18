const axios = require("axios");
const Chat = require("../models/chatSchema");
const Message = require("../models/messagesSchema");
const Group = require("../models/groupSchema");
const UnansweredQuery = require("../models/unansweredQuery");
// ✅ Create a Group
exports.createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = await Group.create({
      name,
      description,
      createdBy: req.user.id,
    });
    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//rename group
exports.renameGroup = async (req, res) => {
  try {
    const { groupId, name } = req.body;
    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    await group.update({ name });
    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ✅ Create Chat (optionally inside a Group)
exports.createChat = async (req, res) => {
  try {
    const { title, groupId } = req.body;
    const chat = await Chat.create({
      userId: req.user.id,
      groupId: groupId || null,
      title: title || "New Chat",
    });
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// rename chat
exports.renameChat = async (req, res) => {
  try {
    const { chatId, title } = req.body;
    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    await chat.update({ title });
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ✅ Get all Groups of user (with Chats)
exports.getGroups = async (req, res) => {
  try {
    const groups = await Group.findAll({
      where: { createdBy: req.user.id },
      include: [
        {
          model: Chat,
          order: [["updatedAt", "DESC"]],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get single Group (with Chats + Messages)
exports.getGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findByPk(groupId, {
      include: [
        {
          model: Chat,
          include: [{ model: Message, order: [["createdAt", "ASC"]] }],
        },
      ],
    });

    if (!group) return res.status(404).json({ message: "Group not found" });
    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get Chats inside specific Group
exports.getGroupChats = async (req, res) => {
  try {
    const { groupId } = req.params;
    const chats = await Chat.findAll({
      where: { groupId },
      order: [["updatedAt", "DESC"]],
    });
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete Group (cascade chats & messages)
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    //find and delete chats inside group
    await Chat.destroy({
      where: { groupId },
    });
    
    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    await group.destroy();
    res.json({ message: "Group deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Add message (User → AI)
exports.addMessage = async (req, res) => {
  try {
    const { chatId, sender, content } = req.body;

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    // 1️⃣ Auto-rename chat title on first user message
    if (sender === "user" && chat.title === "New Chat") {
      await chat.update({ title: content.substring(0, 50) });
    }

    // 2️⃣ Save user message
    const userMsg = await Message.create({ chatId, sender, content });

    // 3️⃣ Get last 5 messages for context
    const lastMessages = await Message.findAll({
      where: { chatId },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });
    const history = lastMessages
      .map((m) => `${m.sender}: ${m.content}`)
      .reverse()
      .join("\n");

    // 4️⃣ Query the AI microservice
    const startTime = Date.now();
    const aiRes = await axios.post("https://python.biomelc.com/query", {
      query: content,
      chat_history: history,
    });
    console.log(aiRes.data);
    const endTime = Date.now();
    const responseTime = ((endTime - startTime) / 1000).toFixed(2);

    const data = aiRes?.data || {};
    const aiText =
      data.ans ||
      "I'm sorry, I don't yet have the knowledge to answer this question.";

    // 5️⃣ Handle sources
    let sources = [];
    if (Array.isArray(data.sources) && data.sources.length > 0) {
      sources = data.sources.map((src) => ({
        source: src.source || null,
        where_to_find: src.where_to_find || null,
        timestamps: src.timestamps || null,
        category: src.category || null,
        tools: Array.isArray(src.tools)
          ? src.tools
          : src.tools
          ? [src.tools]
          : [],
      }));
    } else {
      sources.push({
        source: data.source ?? null,
        where_to_find: data.where_to_find ?? null,
        timestamps: data.timestamps ?? null,
        category: data.category ?? null,
        tools: Array.isArray(data.tools)
          ? data.tools
          : data.tools
          ? [data.tools]
          : [],
      });
    }

    // 6️⃣ Create AI message
    const aiMsg = await Message.create({
      chatId,
      sender: "ai",
      content: aiText,
      meta: {
        sources,
        query: data.query ?? content,
        success: data.success ?? true,
        error: data.error ?? null,
        response_time: `${responseTime}s`,
        ai_timestamp: new Date().toISOString(),
      },
    });

    // 7️⃣ Save unanswered query if AI fallback message triggered
    if (
      aiText.includes(
        "I'm sorry, I don't yet have the knowledge to answer this question."
      )
    ) {
      await UnansweredQuery.create({ message: content });
      console.log("🧠 Unanswered query saved:", content);
    }

    // 8️⃣ Update chat’s timestamp
    await chat.update({ updatedAt: new Date() });

    res.json({ user: userMsg, ai: aiMsg });
  } catch (err) {
    console.error("❌ Chat Error:", err);
    res.status(500).json({ error: err.message });
  }
};



// ✅ Get all chats of logged-in user
exports.getUserChats = async (req, res) => {
  try {
    const chats = await Chat.findAll({
      where: { userId: req.user.id },
      order: [["updatedAt", "DESC"]],
    });
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get all messages in a chat
exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.findAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
    });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete chat
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    await chat.destroy();
    res.json({ message: "Chat deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
