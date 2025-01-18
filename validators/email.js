import fs from 'fs';
import dns from 'dns';
import pkg from 'validator';
const { isEmail } = pkg,
    domainFilePath = './validators/domains.json';

var domainSet;


const initDomainSet = () => {
    domainSet = loadDomainSet(domainFilePath);
},
    isSpamDomain = (email, domainSet) => {
        const domain = email.split('@')[1];
        return domainSet.has(domain);
    },
    loadDomainSet = (filePath) => {
        const data = fs.readFileSync(filePath, 'utf-8');
        const domains = JSON.parse(data);
        return new Set(domains); // create a set for O(1) lookups
    };


function validateDomain(email) {
    return new Promise(resolve => {
        const domain = email.split('@')[1];
        dns.resolveMx(domain, (err, addresses) => {
            if (err || addresses.length === 0) resolve(false);
            else resolve(true);
        });
    });
}


export async function validateEmail(email) {
    if (!domainSet) initDomainSet();
    else if (!email) return false;
    email = email.trim();

    // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // if (!emailRegex.test(email)) return false;

    if (!isEmail(email, { allow_ip_domain: false })) return false;
    else if (isSpamDomain(email, domainSet)) return false;

    if (!(await validateDomain(email))) return false;
    return true;
}