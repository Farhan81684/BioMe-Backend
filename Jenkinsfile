pipeline {
    agent any
    environment{
        DOCKER_USER = "farhanraju"
        BACKEND_IMAGE = "maya-backend"
        K8S_CRED = "k8s-config"
    }

    stages {
        stage('Git checkOut') {
            steps {
                checkout scm
            }
        }
    }
}

