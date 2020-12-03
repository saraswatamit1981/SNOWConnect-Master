var config = require('./config.json');
var botId = config.credentials.botId;
var botName = config.credentials.botName;
var sdk = require("./lib/sdk");
var request = require('request');
var Promise = require('bluebird');
var request = Promise.promisify(request);
var api = require('./SnowChatAPINew.js');
var _ = require('lodash');
var debug = require('debug')("Agent");
var redisOperations = require('./redisOperations.js');
var redis = require("./lib/RedisClient.js").createClient(config.redis);
var twilio = require('twilio');

var lastMsgId;
var isLastMsg = false;                  
var idNo ="@L";
function clearRedisData(visitorId)
{
console.log('deleting redis data and user entry for',visitorId);
redisOperations.deleteRedisData("data:"+visitorId);
redisOperations.deleteRedisData("user:"+visitorId); 
}

function sendMessagetoBotUser(req, res) {
    var reqBody     = req.body;
    if (reqBody && reqBody && reqBody.group) {
        var groupId = reqBody.group;
        console.log("Group ID - ", groupId);
        console.log("Agent Response - ", reqBody.formatted_message);        
        var dataFromRedis = redisOperations.getRedisData("data:"+groupId)
            .then(function(data) {
                if (data) {
                    var visitorId = _.get(data, 'channel.channelInfos.from');
                    if (!visitorId) {
                        visitorId = _.get(data, 'channel.from');
                    }
                    var newMessage = reqBody.formatted_message;
                    var sysCreatedBy = reqBody.sys_created_by;
                    var lastMessageFlag = reqBody.last_message;
                    if (sysCreatedBy == 'system' && lastMessageFlag == 'true' &&  (newMessage.indexOf('closed') + newMessage.indexOf('left')) > 0) {
                        console.log("Agent end condition is true.\n")
                        data.message = newMessage;
                        lastMsgId = data.requestId;
                        console.log('replying '+data.message+" with lastMsgId:"+lastMsgId+" for data.message_id:"+data.message_id);
                        sdk.sendUserMessage(data, function(err, done) {
                            console.log('sendUserMessage:', data.message);
                        }).catch(function(e) {
                            console.log("sending agent reply error", e);
                            
                        });
                        sdk.clearAgentSession(data);
                        clearRedisData(visitorId);
                        clearRedisData(groupId);
                    } else {
                        data.message = newMessage;
                        data.message_id = reqBody.sys_id;
                        lastMsgId = data.message_id;
                        if(newMessage.indexOf(idNo)!== -1){
                        var split = newMessage.split("|");
                        var sys_id = split[0].split("?");
                        var incidentId = split[1].replace("]","");
                        newMessage = split[1].replace("]","");
                        data.message = "Call Record "+newMessage+" created.";
                        }
                        console.log('replying '+data.message+" with lastMsgId:"+lastMsgId+" for data.message_id:"+data.message_id);
                        sdk.sendUserMessage(data, function(err, done) {
                            console.log("sendUserMessage", data.message);
                        }).catch(function(e) {
                            console.log(e);
                            debug("sending agent reply error", e);
                            clearRedisData(visitorId);
                            clearRedisData(groupId);
                        });
                        var entry = {
                            visitorId: visitorId,
                            group: groupId
                        };
                        redisOperations.updateRedisWithEntry(visitorId,groupId,entry).then(function(){
                            redisOperations.setTtl(visitorId,'user');
                        });
                    }
                }
            });
    }

}
function gethistory(req, res) {
    var userId = req.query.userId;
    return redisOperations.getRedisData("data:"+userId)
    .then(function(data)
    {console.log("Function get history called");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache"); 
    res.setHeader("Expires", "0");
            
    if (data) {
        data.limit = 20;
        data.userId = userId;
        return sdk.getMessages(data, function(err, resp) {
            if (err) {
                res.status(400);
                return res.json(err);
            }
            var messages = resp.messages;
            res.status(200);
            return res.json(messages);
        });
    } else {
        var error = {
            msg: "Invalid user",
            code: 401
        };
        res.status(401);
        return res.json(error);
    }
})
}

function connectToAgent(requestId, data, cb) {
    console.log("Connected to agent...");
    var agentLanguage='';
    if(data.context.langPreference){
    console.log("Language Settings:",data.context.langPreference);
    agentLanguage=data.context.langPreference;
    }
    else
    {
        agentLanguage=config.servicenow.queueId;   
    }    
    var formdata = {};
    formdata.licence_id = config.liveagentlicense;
    formdata.welcome_message = "";
    var visitorId = _.get(data, 'channel.channelInfos.from');
    if (!visitorId) {
        visitorId = _.get(data, 'channel.from');
    }
    redisOperations.updateRedisWithData(visitorId,data).then(function(){
            redisOperations.setTtl(visitorId,'data');
        });;
    
    var email;
    try { 
        email = data.context.session.BotUserSession.lastMessage.messagePayload.botInfo.customData.email;
        }
    catch(err) {
        email = "unauthenticated user";
    }
    var lastMsg = "You are speaking to ["+email+"], authenticated by WebSSO.";
    var ccrId = data.context.session.BotUserSession.ccrId;
    var firstMessage = lastMsg+"\nLink for User Chat History with the bot: " + config.app.url + config.app.apiPrefix+ "/history/index.html?visitorId=" + visitorId+"\n"+"\nCall Record Created: "+ccrId;
    var chat_queue_entry_data = {
        "message":firstMessage
       
    };
    api.createChatQueueEntry(chat_queue_entry_data,agentLanguage).then(function(chat_queue_entry) {
    // Shantanu Code to handle error in create chat queue creation start
    console.log("Error response status while chat queue creation: ", chat_queue_entry.statusCode);

        if(chat_queue_entry.statusCode != undefined){
            sdk.clearAgentSession(data);            
            data.message = "Error occurred while connecting to agent. You can continue chatting with the bot.";
            return sdk.sendUserMessage(data, cb);
        } else {
            var group = chat_queue_entry.result.group;
            var messageLength;
            var entry = {
                visitorId: visitorId,
                group: group,
                messageLength : 0
            };
            redisOperations.updateRedisWithData(group,data).then(function(){
            redisOperations.setTtl(group,'data');
            });
            redisOperations.updateRedisWithEntry(visitorId,group,entry).then(function(){
            redisOperations.setTtl(visitorId,'user');
            });
             redisOperations.updateRedisWithEntry(group,entry);
        }       
        });
  }

/*
 * onBotMessage event handler
 */
function onBotMessage(requestId, data, cb) {
    debug("Bot Message Data", data);
    var visitorId = _.get(data, 'channel.from');
    if (!visitorId) {
        visitorId = _.get(data, 'channel.from');
    }
    
    var entryFromRedis = redisOperations.getRedisData("user:"+visitorId)
    .then(function(result) {
    if(result){
        if (data.message.length === 0 || data.message === '') {
            return;
        }
        var message_tone = _.get(data, 'context.dialog_tone');
        if (message_tone && message_tone.length > 0) {
            var angry = _.filter(message_tone, { tone_name: 'angry' });
            if (angry.length) {
                angry = angry[0];
                if (angry.level >= 2) {
                    connectToAgent(requestId, data);
                } else {
                    sdk.sendUserMessage(data, cb);
                }
            } else {
                sdk.sendUserMessage(data, cb);
            }
        } else if (!entry) {
            sdk.sendUserMessage(data, cb);
        }
    } else {
        sdk.sendUserMessage(data, cb);
    }
    })
}

/*
 * OnUserMessage event handler
 */
function onUserMessage(requestId, data, cb) {
    var databackup = data;
    var data = data.toJSON();
    var visitorId = data.context.session.UserContext._id; 
    var entryFromRedis  = redisOperations.getRedisData("user:"+visitorId)
    .then(function(entry) {
    if (entry) {
        if (data.message.trim().toLowerCase() == "stop chat") {
            entry.messageLength = 0;
            clearRedisData(visitorId);
            clearRedisData(entry.group);   
            sdk.clearAgentSession(data);          
            data.message = "Ok, the conversation with the Agent has been stopped. You can continue chatting with the bot.";
            sdk.sendUserMessage(data, cb);
            var message_data = {
            "message": "Please end the chat. Thanks!",
            "group": entry.group,
            "reflected_field": "comments"
            }
            return api.sendMessage(message_data,entry.group)
            .catch(function(e) {
                console.error(e);
                clearRedisData(visitorId);
                
                return sdk.sendBotMessage(data, cb);
            });
        }
        //route to live agent
        else {
            
            var group = entry.group;
            redisOperations.updateRedisWithData(group,data).then(function(){ 
                redisOperations.setTtl(group,'data'); 
            });
            
            redisOperations.updateRedisWithData(visitorId,data).then(function(){ 
                redisOperations.setTtl(visitorId,'data'); 
            });
            
            redisOperations.updateRedisWithEntry(visitorId,group,entry).then(function(){
                redisOperations.setTtl(visitorId,'user');
            });
            var message_data = {
            "message": data.message,
            "group": entry.group,
            "reflected_field": "comments"
            }
            return api.sendMessage(message_data,entry.group)
            .catch(function(e) {
                console.error(e);
                clearRedisData(visitorId);              
                return sdk.sendBotMessage(data, cb);
            });
        }
        
    } else {
        console.log("bot responding directly - visitor entry not found");
        sdk.clearAgentSession(databackup);
        return sdk.sendBotMessage(databackup, cb);
    }
    });
}

/*
 * OnAgentTransfer event handler
 */
function onAgentTransfer(requestId, data, callback) {
    console.log("in onAgentTransfer...");
    connectToAgent(requestId, data, callback);
}
function sendSmsNotification(canton,age,sex){
var accountSid = config.twilio.accountSid;
var authToken = config.twilio.authToken;

var client = new twilio(accountSid, authToken);

client.messages.create({
    body: 'CovidHelper: I found a emergency at '+canton+','+age+','+sex+'. Please help immediately.',
    to: '+41798566654',  // Text this number
    messagingServiceSid: config.twilio.messagingServiceSid
}).then((message) => console.log(message));
}


module.exports = {
    botId: botId,
    botName: botName,
    on_user_message: function(requestId, data, callback) {
        debug('on_user_message');
        onUserMessage(requestId, data, callback);
    },
    on_bot_message: function(requestId, data, callback) {
        debug('on_bot_message');
        onBotMessage(requestId, data, callback);
    },
    on_agent_transfer: function(requestId, data, callback) {
        console.log("module exports on_agent_transfer");
        sendSmsNotification(data.context.entities.Canton,data.context.entities.Age,data.context.entities.Gender);
        debug('on_webhook');
        onAgentTransfer(requestId, data, callback);
    },
    on_webhook : function(requestId, data, componentName, callback) {
        console.log("On web hook");
        console.log(botName,botId);
        if (componentName === 'WelcomeDelay1') {
            setTimeout(function() {
                callback(null, data);
            }, 2000);
        } 
    },
    gethistory: gethistory,
    sendMessagetoBotUser: sendMessagetoBotUser
};
