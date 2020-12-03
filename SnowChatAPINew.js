var config = require('./config.json');
var botId = config.credentials.botId;
var botName = config.credentials.botName;
var sdk      = require("./lib/sdk");
var Promise  = require('bluebird');
var request = require('request-promise');
var template = require('url-template');
var authorization = config.servicenow.authorization;
var userId = config.servicenow.userId;
var queueId = config.servicenow.queueId; //DB Actual queue

function autoParse(body, response, resolveWithFullResponse) {
    if (response.headers['content-type'] === 'application/json') {
        return {
         "headers": response.headers,   
         "body": JSON.parse(body)
        }
    } else {
        return {
         "headers": response.headers,   
         "body": body
        }
    }
}

var baseUrl = config.servicenow.host+"/api/now";

function createChatQueueEntry(data,queue){
    console.log("data values",data);
    console.log("Langugae set in API:",queue);
    queueId=queue;
    var url = baseUrl+"/connect/support/queues/"+queueId+"/sessions";
    var options = {
        method: 'POST',
        uri: url,
        body: data,
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authorization,
            'Accept': 'application/json'
        }
    };
    return request(options).then(function(res){
        console.log("Create chat response: ", JSON.stringify(res));
        return res;
    })
    .catch(function(err){
        console.log("Error in queue connection: ", err)
        return err;
    });
}

function sendMessage(data,group){
    var url = baseUrl+"/connect/conversations/"+group+"/messages";
    var options = {
        method: 'POST',
        uri: url,
        body: data,
        json: true,
        headers: {
            'content-type': 'application/json',
            'Authorization': authorization,
            'Accept': 'application/json'
        }
    };
    return request(options).then(function(res){
        console.log("response in SNOW CHAT API",res);
        return res;
    })
    .catch(function(err){
        return Promise.reject(err);
    });
}

module.exports.createChatQueueEntry = createChatQueueEntry;
module.exports.sendMessage = sendMessage;