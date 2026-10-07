pipeline {
  agent any

  environment {
    // Built once; the same tag is deployed to both dev and prod.
    IMAGE = "livepoll:${BUILD_NUMBER}"
  }

  stages {

    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build image (once)') {
      steps { sh 'docker build -t $IMAGE .' }
    }

    stage('Deploy DEV') {
      steps {
        withCredentials([string(credentialsId: 'poll-admin-pass-dev', variable: 'ADMIN_PW')]) {
          // Single-quoted so Groovy does not interpolate the secret; the shell expands it.
          sh '''
            docker rm -f livepoll-dev || true
            docker run -d --name livepoll-dev \
              --restart unless-stopped \
              -p 3201:3001 \
              -e APP_ENV=dev \
              -e PORT=3001 \
              -e POLL_QUESTION="[DEV] Which language should we test?" \
              -e POLL_OPTIONS="Python,Go,Rust" \
              -e ADMIN_PASSWORD="$ADMIN_PW" \
              $IMAGE
          '''
        }
      }
    }

    stage('Smoke test DEV') {
      steps {
        sh 'sleep 3 && curl -fsS http://localhost:3001/health'
      }
    }

    stage('Approve PROD') {
      steps { input message: 'DEV looks good. Deploy to PROD?' }
    }

    stage('Deploy PROD') {
      steps {
        withCredentials([string(credentialsId: 'poll-admin-pass-prod', variable: 'ADMIN_PW')]) {
          sh '''
            docker rm -f livepoll-prod || true
            docker run -d --name livepoll-prod \
              --restart unless-stopped \
              -p 3002:3002 \
              -e APP_ENV=prod \
              -e PORT=3002 \
              -e POLL_QUESTION="Which language should we adopt company-wide?" \
              -e POLL_OPTIONS="Python,Go,Rust,Java" \
              -e ADMIN_PASSWORD="$ADMIN_PW" \
              $IMAGE
          '''
        }
      }
    }

    stage('Smoke test PROD') {
      steps {
        sh 'sleep 3 && curl -fsS http://localhost:3002/health'
      }
    }

    stage('Verify same image') {
      steps {
        sh '''
          DEV_IMG=$(docker inspect livepoll-dev  --format '{{.Image}}')
          PROD_IMG=$(docker inspect livepoll-prod --format '{{.Image}}')
          echo "dev : $DEV_IMG"
          echo "prod: $PROD_IMG"
          [ "$DEV_IMG" = "$PROD_IMG" ]
        '''
      }
    }
  }

  post {
    failure { echo 'Deployment failed. Check the stage logs above.' }
    success { echo "Deployed ${IMAGE} to dev (3001) and prod (3002)." }
  }
}
