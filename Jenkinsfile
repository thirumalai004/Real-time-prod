pipeline {
  agent any

  environment {
    // Built once; the same tag is deployed to both dev and prod.
    IMAGE = "livepoll:${BUILD_NUMBER}"

    // Port the app listens on INSIDE each container (passed as PORT)
    DEV_APP_PORT  = '3001'
    PROD_APP_PORT = '3002'

    // Port published on the HOST (what you open in the browser)
    DEV_HOST_PORT  = '3201'
    PROD_HOST_PORT = '3202'
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
              -p $DEV_HOST_PORT:$DEV_APP_PORT \
              -e APP_ENV=dev \
              -e PORT=$DEV_APP_PORT \
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
        // Jenkins runs inside a container, so "localhost" is NOT the host.
        // Check from inside the app container instead, using the INTERNAL port.
        sh '''
          for i in $(seq 1 10); do
            if docker exec livepoll-dev wget -qO- http://localhost:$DEV_APP_PORT/health; then
              echo
              echo "DEV is healthy"
              exit 0
            fi
            sleep 2
          done
          echo "DEV did not become healthy. Container logs:"
          docker logs livepoll-dev
          exit 1
        '''
      }
    }

    stage('Approve PROD') {
      steps { input message: "DEV is live on host port ${DEV_HOST_PORT}. Deploy to PROD?" }
    }

    stage('Deploy PROD') {
      steps {
        withCredentials([string(credentialsId: 'poll-admin-pass-prod', variable: 'ADMIN_PW')]) {
          sh '''
            docker rm -f livepoll-prod || true
            docker run -d --name livepoll-prod \
              --restart unless-stopped \
              -p $PROD_HOST_PORT:$PROD_APP_PORT \
              -e APP_ENV=prod \
              -e PORT=$PROD_APP_PORT \
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
        sh '''
          for i in $(seq 1 10); do
            if docker exec livepoll-prod wget -qO- http://localhost:$PROD_APP_PORT/health; then
              echo
              echo "PROD is healthy"
              exit 0
            fi
            sleep 2
          done
          echo "PROD did not become healthy. Container logs:"
          docker logs livepoll-prod
          exit 1
        '''
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
    success { echo "Deployed ${IMAGE}: dev on host port ${DEV_HOST_PORT}, prod on host port ${PROD_HOST_PORT}." }
  }
}