import fs from "node:fs";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import sharp from "sharp";
import FormData from "form-data";
import { Client, GatewayIntentBits, ActivityType } from "discord.js";
dotenv.config();
const app = express();
app.use(express.static("public"));
let lastUpdated = JSON.parse(fs.readFileSync("public/lastupdated.json", "utf8"));
let sessionInfo = { checks: { testers: 0, updates: 0, status: 0 }, indupd: 0, ftfupd: 0, erd: 0, efd: 0, esm: 0, tsii: [], lastStatusBegin: new Date().toISOString(), lastStatus: 0, status: 0, startTime: new Date().toISOString(), nextChecks: { testers: "", updates: "", status: "" } };
async function log(data) {
    return fs.appendFileSync("public/logs.txt", `[${new Date().toISOString()}] ${data}\n`);
};
async function send(content, buffer) {
    if (buffer) {
        const form = new FormData();
        form.append('file', buffer, {
            filename: 'image.png',
            contentType: 'image/png'
        });
        form.append('payload_json', JSON.stringify({
            content: content
        }));
        return await axios.post(process.env.webhook, form, { headers: form.getHeaders() })
            .catch((error) => {
                sessionInfo.esm += 1;
                log(`❌ Line 19: Error sending message: ${error}`);
            });
    } else {
        return await axios.post(process.env.webhook, { "content": content }, { "headers": { 'Content-Type': 'application/json' } })
            .catch((error) => {
                sessionInfo.esm += 1;
                log(`❌ Line 19: Error sending message: ${error}`);
            });
    }
};
function timeSince(isostr) {
    const timestamp = new Date(isostr).getTime();
    const now = new Date().getTime();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    let parts = [];
    if (hours && hours > 0) parts.push(`${hours} hora${hours != 1 ? "s" : ""}`);
    if (minutes && minutes > 0) parts.push(`${minutes} minuto${minutes != 1 ? "s" : ""}`);
    if (seconds && seconds > 0) parts.push(`${seconds} segundo${seconds != 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") : "agora";
};
async function downloadImageAsBuffer(url) {
    const response = await axios({
        url,
        responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
};
async function combineImages(imageUrls) {
    const sharpImages = [];
    for (let url of imageUrls) {
        const imageBuffer = await downloadImageAsBuffer(url);
        sharpImages.push(sharp(imageBuffer));
    }
    const { height } = await sharpImages[0].metadata();
    const resizedImagesBuffers = await Promise.all(
        sharpImages.map(image => image.resize({ height }).toBuffer({ resolveWithObject: true }))
    );
    const totalWidth = resizedImagesBuffers.reduce((sum, { info }) => sum + info.width, 0);
    const combinedHeight = resizedImagesBuffers[0].info.height;
    const combinedImageBuffer = await sharp({
        create: {
            width: totalWidth,
            height: combinedHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
    }).composite(resizedImagesBuffers.map((bufferObj, i) => ({
        input: bufferObj.data,
        left: resizedImagesBuffers.slice(0, i).reduce((sum, b) => sum + b.info.width, 0),
        top: 0
    }))).png().toBuffer();
    return combinedImageBuffer;
};
app.get("/info", (_, res) => {
    res.json(sessionInfo);
});
app.get("/check", async function (req, res) {
    if (req.query.check == "testers") {
        await checkTesters();
    } else if (req.query.check == "updates") {
        await checkUpdates();
    } else if (req.query.check == "status") {
        await checkStatus();
    };
    res.json(sessionInfo);
});

const statusEmoji = ['⚫', '🔵', '🟢', '🟠', '❔'];
const statusText = ['offline', 'online', 'jogando', 'no studio', 'invisível'];
async function checkTesters() {
    await axios.get("https://games.roblox.com/v1/games/455327877/servers/0?sortOrder=2&excludeFullGames=false&limit=10", { "headers": { "accept": "application/json" } })
        .then(async instances => {
            if (instances.data["data"]) {
                if (instances.data.data[0] && instances.data.data[0]["playerTokens"]) {
                    if (instances.data.data[0].playerTokens.length < 2 && sessionInfo.tsii.length == 0) return;
                    let changed = false;
                    let batchData = [];
                    let tokens = [];
                    for (let token of instances.data.data[0].playerTokens) {
                        if (!sessionInfo.tsii.includes(token)) {
                            changed = true;
                            sessionInfo.tsii.push(token);
                        };
                        tokens.push(token);
                        batchData.push({ "requestId": `0:${token}:AvatarHeadshot:150x150:png:regular`, "targetId": 0, "token": token, "type": "AvatarHeadShot", "size": "150x150", "format": "png" });
                    };
                    for (let i = 0; i < sessionInfo.tsii.length; i++) {
                        if (!tokens.includes(sessionInfo.tsii[i])) {
                            changed = true;
                            sessionInfo.tsii.splice(i, 1);
                        };
                    };
                    if (changed) {
                        await axios.post("https://thumbnails.roblox.com/v1/batch", batchData, { "headers": { "accept": "application/json", "Content-Type": "application/json" } })
                            .then(async batches => {
                                if (batches.data["data"] && batches.data.data.length > 0) {
                                    let imageUrls = [];
                                    for (let batch of batches.data.data) imageUrls.push(batch.imageUrl);
                                    const combinedImageBuffer = await combineImages(imageUrls);
                                    await send(`\`👥\` desenvolvedores vistos no [indev](<https://www.roblox.com/games/455327877/FTF-In-Dev>):\n-# ||<@&1282180260766548020>||`, combinedImageBuffer);
                                } else {
                                    sessionInfo.erd += 1;
                                    log("❌ Line 130: Error reading data: " + JSON.stringify(batches.data));
                                };
                            })
                            .catch(error => {
                                sessionInfo.efd += 1;
                                log("❌ Line 135: Error fetching data: " + error);
                            });
                    };
                } else if (sessionInfo.tsii.length > 0) {
                    await send(`\`👥\` todos desenvolvedores vistos no [indev](<https://www.roblox.com/games/455327877/FTF-In-Dev>) saíram\n-# ||<@&1282180260766548020>||`);
                    sessionInfo.tsii = [];
                };
            } else {
                sessionInfo.erd += 1;
                log("❌ Line 151: Error reading data: " + JSON.stringify(instances.data));
            };
        })
        .catch(error => {
            sessionInfo.efd += 1;
            log("❌ Line 156: Error fetching data: " + error);
        });
    sessionInfo.checks.testers += 1;
    sessionInfo.nextChecks.testers = new Date(new Date().getTime() + 120000).toISOString();
};
async function checkUpdates() {
    await axios.get("https://games.roblox.com/v1/games?universeIds=372226183", { "headers": { "accept": "application/json" } })
        .then(response => {
            if (response.data["data"] && response.data.data[0] && response.data.data[0]["updated"]) {
                if (response.data.data[0].updated != lastUpdated.ftf && (new Date(response.data.data[0].updated).getTime() > new Date(lastUpdated.ftf).getTime() + 1000)) {
                    log(`✅ FTF updated. From ${lastUpdated.ftf} to ${response.data.data[0].updated}.`);
                    lastUpdated.ftf = response.data.data[0].updated;
                    fs.writeFileSync("public/lastupdated.json", JSON.stringify(lastUpdated));
                    sessionInfo.ftfupd += 1;
                    axios.get("https://thumbnails.roblox.com/v1/games/icons?universeIds=372226183&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false", { "headers": { "accept": "application/json" } })
                        .then(image => {
                            if (image.data["data"] && image.data.data[0] && image.data.data[0]["imageUrl"]) {
                                send(`# \`🚨\` [MARRETÃO](https://www.roblox.com/games/893973440/Flee-the-Facility) ATUALIZOU @everyone\n\`\`\`\n${response.data.data[0].description}\n\`\`\`\n[imagem](${image.data.data[0].imageUrl})\n-# há ${timeSince(response.data.data[0].updated)}`);
                            } else {
                                sessionInfo.erd += 1;
                                log("❌ Line 183: Error reading data: " + JSON.stringify(image.data));
                                send(`# \`🚨\` [MARRETÃO](https://www.roblox.com/games/893973440/Flee-the-Facility) ATUALIZOU @everyone\n\`\`\`\n${response.data.data[0].description}\n-# há ${timeSince(response.data.data[0].updated)}`);
                            }
                        })
                        .catch(error => {
                            sessionInfo.efd += 1;
                            log("❌ Line 189: Error fetching data: " + error)
                        });
                };
            } else {
                sessionInfo.erd += 1;
                log("❌ Line 194: Error reading data: " + JSON.stringify(response.data));
            };
        })
        .catch(error => {
            sessionInfo.efd += 1;
            log("❌ Line 199: Error fetching data: " + error)
        });
    await axios.get("https://games.roblox.com/v1/games?universeIds=174252938", { "headers": { "accept": "application/json" } })
        .then(async response => {
            if (response.data["data"] && response.data.data[0] && response.data.data[0]["updated"]) {
                if (response.data.data[0].updated != lastUpdated.indev && (new Date(response.data.data[0].updated).getTime() > new Date(lastUpdated.indev).getTime() + 1000)) {
                    log(`✅ INDEV updated. From ${lastUpdated.indev} to ${response.data.data[0].updated}.`);
                    lastUpdated.indev = response.data.data[0].updated;
                    fs.writeFileSync("public/lastupdated.json", JSON.stringify(lastUpdated));
                    sessionInfo.indupd += 1;
                    send("# `🚨` [INDEV](<https://www.roblox.com/games/455327877/FTF-In-Dev>) ATUALIZOU @everyone\n-# há " + timeSince(response.data.data[0].updated));
                };
            } else {
                sessionInfo.erd += 1;
                log("❌ Line 161: Error reading data: " + JSON.stringify(response.data));
            };
        })
        .catch(error => {
            sessionInfo.efd += 1;
            log("❌ Line 166: Error fetching data: " + error);
        });
    sessionInfo.checks.updates += 1;
    sessionInfo.nextChecks.updates = new Date(new Date().getTime() + 60000).toISOString();
};
async function checkStatus() {
    await axios.post("https://presence.roblox.com/v1/presence/users", { "userIds": [7140919] }, {
        headers: {
            "accept": "application/json",
            "Content-Type": "application/json"
        }
    })
        .then(function (response) {
            if (response.data["userPresences"] && response.data.userPresences[0] && !isNaN(response.data.userPresences[0]["userPresenceType"])) {
                if (sessionInfo.status != response.data.userPresences[0].userPresenceType) {
                    log(`🔎 MrWindy's status changed from ${sessionInfo.status} to ${response.data.userPresences[0].userPresenceType}`);
                    sessionInfo.lastStatus = sessionInfo.status;
                    sessionInfo.status = response.data.userPresences[0].userPresenceType;
                    send(`\`${statusEmoji[sessionInfo.status]}\` o [MrWindy](<https://www.roblox.com/users/7140919/profile>) está ${statusText[sessionInfo.status]}\n-# ficou ${statusText[sessionInfo.lastStatus]} por ${timeSince(sessionInfo.lastStatusBegin)}\n-# ||<@&1288597811494912020>||`);
                    sessionInfo.lastStatusBegin = new Date().toISOString();
                };
            } else {
                sessionInfo.erd += 1;
                log("❌ Line 214: Error reading data: " + JSON.stringify(response.data));
            };
        })
        .catch(function (error) {
            sessionInfo.efd += 1;
            log(`❌ Line 219: Error fetching data: ${error}`);
        });
    sessionInfo.checks.status += 1;
    sessionInfo.nextChecks.status = new Date(new Date().getTime() + 30000).toISOString();
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const startUp = (f, t) => { f(); setInterval(f, t * 1000); };
const changeName = (n, c) => { if (c.name != n) return c.setName(n); };
client.on('ready', async function () {
    const tc = await client.channels.fetch('1288589225561948232');
    await changeName("│-̗̀🔨∙ftfsky", tc);
    send('Olá, estou online.')
    client.user.setPresence({
        activities: [{
            name: 'MrWindy',
            type: ActivityType.Watching
        }],
        status: 'online'
    });
    startUp(checkTesters, 120);
    startUp(checkUpdates, 60);
    startUp(checkStatus, 30);   
    log("🟢 Online");
    for (let evt of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
        process.on(evt, async function () {
            process.stdin.resume();
            await changeName("│-̗̀🔨∙ftfsky", tc);
            await log("🔴 Offline");
            process.exit();
        });
    };
    console.log("Online como:" + (process.env.TOKEN))
});
app.listen(process.env.PORT || 5000, function () {
    console.log("✅ http://localhost:" + (process.env.PORT || 5000));
}).on('error', (err) => {
    console.error('Erro ao iniciar o servidor:', err);
});

client.login(process.env.TOKEN);
