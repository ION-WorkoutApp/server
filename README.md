# The Server for the ION Workout App

## Before You Read
Make sure you wouldn't rather use one of the [installers](https://github.com/ION-WorkoutApp/installers?tab=readme-ov-file#ion-workout-app-installers)

## Setup
*NOTE: The default `run` command will attempt to run a cloudflared tunnel to foreward the server, make sure this is set up first if you want this functionality*

1. clone this repo
2. create the ENV file (see the **Environment** section below)
3. run `make setup`

*Why does `make setup` run `make fixPermissions`? Because mongodb does funny things with permissions then can't read it's own data directory*


# Environment
Create an env file in the base directory called `.env` with the following structure:

```env
PORT=1221
SECRET_KEY=yourSecret
MONGO_URI=mongodb://yourUser:yourPassword@mongodb:27017/userDatabase?authSource=admin
MONGO_INITDB_ROOT_USERNAME=yourUser
MONGO_INITDB_ROOT_PASSWORD=yourPassword
MONGO_DATABASE=maindb
EMAIL_USER=example@example.com
EMAIL_PASS=mysupersecurepassword1
EMAIL_SMTP_HOST=smtp.example.com
EMAIL_SMTP_PORT=465
DEBUGGING=true
```


## Reset the Database
just run `make resetLocal`


# Credits!

I couldn't get the default function to work for some reason, but credit to the blocked email list goes to https://github.com/IntegerAlex/disposable-email-detector, awesome tool!
