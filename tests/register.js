import fetch from 'node-fetch';
import { validateEmail } from '../validators/email';


async function testAPI() {
    const o = {
        Name: 'NAME',
        Email: 'ion606@protonmail.com',
        Password: 'password',
        Age: '22',
        Gender: 'Male',
        Height: '22',
        Weight: '80',
        FitnessGoal: 'Increase Strength',
        PreferredWorkoutType: 'Bodyweight Only',
        ServerURL: 'http://localhost:1221'
    };

    const r = await fetch(`${o.ServerURL}/initaccount`, {
        body: JSON.stringify(o),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const body = await r.json();
    console.log(body);
}


testAPI().catch(console.error).finally(() => console.log('test run!'));