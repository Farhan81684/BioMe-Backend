pipeline {
    agent any
    environment {
        DOCKER_USER = "farhanraju"
        BACKEND_IMAGE = "biome-backend" 
        K8S_CRED = "k8s-config"
        // Build number ko tag ke tor par use karna best practice hai
        IMAGE_TAG = "${env.BUILD_NUMBER}" 
    }

    stages {
        stage('1. Git checkout') {
            steps {
                checkout scm
            }
        }

        stage('2. Build & Push Backend') {
            steps {
                script {
                    withCredentials([string(credentialsId: 'id_for_imagepush', variable: 'dockerhubpwd')]) {
                        sh "docker login -u ${DOCKER_USER} -p ${dockerhubpwd}"
                        
                        // Tagging with Build Number for better tracking
                        sh "docker build -t ${DOCKER_USER}/${BACKEND_IMAGE}:${IMAGE_TAG} ."
                        sh "docker build -t ${DOCKER_USER}/${BACKEND_IMAGE}:latest ."
                        
                        sh "docker push ${DOCKER_USER}/${BACKEND_IMAGE}:${IMAGE_TAG}"
                        sh "docker push ${DOCKER_USER}/${BACKEND_IMAGE}:latest"
                    }
                }
            }
        }

        stage('3. Deploy to Kubernetes') {
            steps {
                script {
                    // Ye logic decide karega ke staging namespace mein deploy karna hai ya main mein
                    def targetNamespace = (env.BRANCH_NAME == 'main') ? 'main' : 'staging'
                    def targetFolder = (env.BRANCH_NAME == 'main') ? 'k8s/main/backend' : 'k8s/staging/backend'
                    def deployName = (env.BRANCH_NAME == 'main') ? 'backend-main' : 'backend-staging'

                    withKubeConfig([credentialsId: "${K8S_CRED}"]) {
                        // Deployment file mein image tag update karna
                        sh "sed -i 's|image: ${DOCKER_USER}/${BACKEND_IMAGE}:.*|image: ${DOCKER_USER}/${BACKEND_IMAGE}:${IMAGE_TAG}|g' ${targetFolder}/backend-deploy.yaml"
                        
                        // Apply specific folder based on branch
                        sh "kubectl apply -f ${targetFolder}/ -n ${targetNamespace}"
                        
                        // Rollout restart deployment taake naya code foran reflect ho
                        sh "kubectl rollout restart deployment/${deployName} -n ${targetNamespace}"
                    }
                }
            }
        }
    }
    
    post {
        always {
            // Build ke baad purani images delete karna taake server full na ho
            sh "docker rmi ${DOCKER_USER}/${BACKEND_IMAGE}:${IMAGE_TAG} || true"
        }
    }
}
