const fs = require('fs');
const readlineSync = require('readline-sync');
const crypto = require('crypto-js');

const askQuestion = (question) => {
    const decorators = "\n>>> ";
    return readlineSync.question(question + decorators);
}

const askForPassword = (question) => {
    const decorators = "\n>>> ";
    return readlineSync.question(question + decorators, { hideEchoBack: true });
}

const askForMasterPassword = () => {
    return askForPassword("What is the password, master?");
}

const askForNewSourcePassword = (source) => {
    return askForPassword("What will be the password for <" + source + "> ?")
}

const askForSource = () => {
    return askQuestion("What is the source?");
}


const isExitMasterPass = (masterPass) => {
    if (masterPass === "") return true;
}

const run = () => {
    masterPass = askForMasterPassword();
    let sources = Object.keys(db["passwords"]);

    if (isExitMasterPass(masterPass)) return;
    if (sources !== undefined && sources.length > 0) {
        if (verifyMasterPass(masterPass, sources)) {
            console.log("Welcome, master! ^_^");
            performActions();
        } else {
            console.log("You are not my master >_<")
        }
    } else {
        console.log("No passwords yet. Any master password is good.");
        performActions();
    }
}

const verifyMasterPass = (masterPass, sources) => {
    var hashedMasterPass = crypto.SHA256(masterPass).toString(crypto.enc.ut);
    try {
        var pass = crypto.AES.decrypt(db["passwords"][sources[0]], masterPass).toString(crypto.enc.Utf8);
        console.log("pass", pass);
        var hashedMasterPassFromPass = pass.substr(0, 64); // Get hash of master pass prefixed to the pass
        return hashedMasterPassFromPass === hashedMasterPass;
    } catch (e) {
        return false;
    }
}

const performActions = () => {
    var idx = readlineSync.keyInSelect(menu, "Select an option", { cancel: false });
    var option = menu[idx];
    switch (option) {
        case "Get password":
            getPassword();
            break;
        case "Add new password":
            addNewPassword();
            break;
        case "Change master password":
            changeMasterPassword();
            break;
        case "Exit":
            return;
    }

    performActions();
}

const getPassword = () => {
    var source = askForSource();
    var encryptedPassword = db["passwords"][source];

    if (encryptedPassword !== undefined) {
        var passwordWithPrefix = crypto.AES.decrypt(encryptedPassword, masterPass).toString(crypto.enc.Utf8)
        var password = passwordWithPrefix.substr(64);
        console.log("\n" + password);
    } else {
        console.log("This source does not exist.");
    }
}

const addNewPassword = () => {
    const source = askForSource();
    if (sourceExists(source)) {
        console.log("Source already exists.");
    } else {
        if (source === "") {
            console.log("Source cannot be empty");
            return;
        }

        const password = askForNewSourcePassword(source);
        if (password === "") {
            console.log("Password cannot be empty");
            return;
        }

        var masterPassHash = crypto.SHA256(masterPass).toString();
        var encryptedPassword = crypto.AES.encrypt(masterPassHash + password, masterPass).toString(); // First 64 chars will be the hash of the master pass
        db["passwords"][source] = encryptedPassword;
        updateDb();
        console.log(`Entry added: <${source}>: ${encryptedPassword}`);
    }
}

const sourceExists = (source) => {
    return db["passwords"][source] !== undefined
}

const updateDb = () => {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

const changeMasterPassword = () => {
    var newMasterPassword = askForPassword("What shall the new master password be?");
    if (newMasterPassword === "") {
        console.log("Master password cannot be empty");
        return;
    }

    var newMasterPasswordConfirm = askForPassword("Confirm the new master password");

    if (newMasterPassword !== newMasterPasswordConfirm) {
        console.log("The password don't match. Try again");
        return;
    }

    reprocessPasswordsWithNewMasterPass(masterPass, newMasterPassword);

    updateDb();
    console.log("Master password updated");
    masterPass = newMasterPassword;
}

const reprocessPasswordsWithNewMasterPass = (oldMasterPass, newMasterPass) => {
    var sources = Object.keys(db["passwords"]);
    var corruptedSources = [];
    var updatedSources = [];
    for (var source in sources) {
        var encryptedPass = db["passwords"][sources[source]];
        var decryptedPass = crypto.AES.decrypt(encryptedPass, oldMasterPass).toString(crypto.enc.Utf8);
        var oldMasterPassHash = decryptedPass.substr(0, 64);
        if (crypto.SHA256(oldMasterPass).toString() !== oldMasterPassHash) {
            corruptedSources.push(source);
        } else {
            var password = decryptedPass.substr(64);
            var newMasterPassHash = crypto.SHA256(newMasterPass).toString();
            var newEncryptedPass = crypto.AES.encrypt(newMasterPassHash + password, newMasterPass).toString();
            db["passwords"][sources[source]] = newEncryptedPass;
            updatedSources.push(source);
        }
    }

    console.log("Updated " + updatedSources.length + " passwords.");
    if (corruptedSources.length > 0) {
        console.log("There are " + corruptedSources.length + " corrupted passwords: ", corruptedSources);
    }
}

var masterPass;
const dbPath = "db.json";
var db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
var menu = ["Get password", "Add new password", "Change master password", "Exit"];
run();
