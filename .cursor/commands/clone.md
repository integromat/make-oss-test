Ask for app name and store it as variable APP_NAME.

Argument --local-dir will then be:
LOCAL_DIR=/apps/<APP_NAME>

RUN command
npx make-cli clone <APP_NAME> --local-dir <LOCAL_DIR> --make-host eu1.make.com
