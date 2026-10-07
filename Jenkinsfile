pipeline {
    agent any
    
    parameters {
        choice(name: 'ENVIRONMENT', choices: ['dev', 'staging', 'production'], description: 'Select target environment')
    }
    
    environment {
        IMAGE_NAME = 'realtime-chat-app'
        DOCKER_REGISTRY = 'your-dockerhub-username'
    }
    
    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    app = docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${params.ENVIRONMENT}-${env.BUILD_NUMBER}")
                }
            }
        }
        
        stage('Push to Registry') {
            steps {
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'docker-hub-credentials') {
                        app.push()
                        app.push("${params.ENVIRONMENT}-latest")
                    }
                }
            }
        }
        
        stage('Deploy') {
            steps {
                script {
                    if (params.ENVIRONMENT == 'production') {
                        echo "Deploying securely to Production..."
                    } else {
                        echo "Deploying to ${params.ENVIRONMENT} environment..."
                    }
                }
            }
        }
    }
    
    post {
        success {
            echo "Pipeline completed successfully for ${params.ENVIRONMENT}!"
        }
        failure {
            node {
                echo "Pipeline failed. Check logs for details."
            }
        }
        always {
            node {
                cleanWs()
            }
        }
    }
}