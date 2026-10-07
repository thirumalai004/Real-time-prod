pipeline {
    agent any
    parameters {
        choice(name: 'TARGET_ENV', choices: ['dev', 'prod'], description: 'Which environment to deploy')
    }
    environment {
        IMAGE       = "thirudocker004/live-poll"
        CREDS       = credentials('dockerhub-creds')
        ADMIN_TOKEN = credentials('poll-admin-token')
    }
    options { timestamps() }
    stages {
        stage('Checkout') { steps { checkout scm } }
        stage('Select Config') {
            steps {
                script {
                    if (params.TARGET_ENV == 'prod') {
                        env.HOST_PORT = '4001'; env.APP_ENV = 'prod'; env.LOG_LEVEL = 'info'
                        env.POLL_QUESTION = 'Which language should the team standardize on?'
                        env.POLL_OPTIONS = 'Node.js,Python,Go,Java'
                    } else {
                        env.HOST_PORT = '4000'; env.APP_ENV = 'dev'; env.LOG_LEVEL = 'debug'
                        env.POLL_QUESTION = 'Dev test: which language do you prefer?'
                        env.POLL_OPTIONS = 'Node.js,Python,Go'
                    }
                }
            }
        }
        stage('Unit Tests') { steps { sh 'docker build --target test -t $IMAGE:test-$BUILD_NUMBER .' } }
        stage('Build') {
            steps { sh 'docker build --build-arg BUILD_NUMBER=$BUILD_NUMBER -t $IMAGE:$BUILD_NUMBER -t $IMAGE:latest .' }
        }
        stage('Smoke Test') {
            steps {
                sh '''
                  docker run -d --name smoke-$BUILD_NUMBER -e ADMIN_TOKEN=smoke-test-token -e APP_ENV=smoke $IMAGE:$BUILD_NUMBER
                  for i in 1 2 3 4 5 6 7 8 9 10; do
                    if docker exec smoke-$BUILD_NUMBER wget -q --spider http://localhost:3000/health; then
                      if docker exec smoke-$BUILD_NUMBER wget -qO- http://localhost:3000/config | grep -q smoke-test-token; then
                        echo "SECRET LEAKED in /config"; exit 1
                      fi
                      echo "Health check passed, no secret in /config"; exit 0
                    fi
                    sleep 2
                  done
                  docker logs smoke-$BUILD_NUMBER; exit 1
                '''
            }
            post { always { sh 'docker rm -f smoke-$BUILD_NUMBER || true' } }
        }
        stage('Push') {
            steps {
                sh '''
                  echo "$CREDS_PSW" | docker login -u "$CREDS_USR" --password-stdin
                  docker push --quiet $IMAGE:$BUILD_NUMBER
                  docker push --quiet $IMAGE:latest
                '''
            }
        }
        stage('Approve Production') {
            when { expression { params.TARGET_ENV == 'prod' } }
            steps { input message: 'Deploy to PRODUCTION?', ok: 'Deploy' }
        }
        stage('Deploy') {
            steps {
                sh '''
                  docker rm -f live-poll-$TARGET_ENV || true
                  docker run -d --name live-poll-$TARGET_ENV --restart unless-stopped \
                    -p $HOST_PORT:3000 -e APP_ENV -e LOG_LEVEL -e POLL_QUESTION -e POLL_OPTIONS -e ADMIN_TOKEN \
                    $IMAGE:$BUILD_NUMBER
                '''
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
            // Put any failure shell commands here if needed
        }
    }
    always {
        node {
            cleanWs()
        }
    }
}
