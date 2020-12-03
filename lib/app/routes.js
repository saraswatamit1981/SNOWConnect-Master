var sdk            = require("../sdk");
var serviceHandler = require("./serviceHandler").serviceHandler;
var apiPrefix      = require("../../config").app.apiPrefix;
var livechat = require("../../SnowChatNew.js")
var config         = require("../../config.json");
var jwt            = require('jsonwebtoken');
var bodyparser       = require('body-parser');
var redisOperations = require('../../redisOperations.js');


function loadroutes(app) {
    app.use(bodyparser.json());
	app.post(apiPrefix + '/sdk/bots/:botId/components/:componentId/:eventName', function(req, res) {
        var reqBody     = req.body;
        var botId       = req.params.botId;
        var componentId = req.params.componentId;
        var eventName   = req.params.eventName;

		console.log("Event from routes.js :- ",eventName);
    
        if(req && req.body && req.body.requestId){
            redisOperations.updateRedisById(req.body.requestId);
        }
        serviceHandler(req, res, sdk.runComponentHandler(botId, componentId, eventName, reqBody));

    });
    app.post(apiPrefix + '/sdk/bots/:botId/:eventName', function(req, res) {
        var reqBody     = req.body;
        var botId       = req.params.botId;
        var eventName   = req.params.eventName;
        console.log("Event from routes.js :-- ",eventName);
    
        if(req && req.body && req.body.requestId){
            redisOperations.updateRedisById(req.body.requestId)
        }

        serviceHandler(req, res, sdk.runComponentHandler(botId, 'default', eventName, reqBody));
    });
	app.get(apiPrefix +'/gethistory', livechat.gethistory);
    app.post(apiPrefix+'/api/users/sts', function(req, res) { 
        var identity = req.body.identity;
        var clientId = config.credentials.appId//req.body.clientId;
        var clientSecret = config.credentials.apikey//req.body.clientSecret;
        var isAnonymous = req.body.isAnonymous || false;
        var aud = req.body.aud || "https://idproxy.kore.com/authorize";
        var fName = req.body.fName;
        var lName = req.body.lName;
        var options = {
            "iat": new Date().getTime(),
            "exp": new Date(new Date().getTime() + 24 * 60 * 60 * 1000).getTime(),
            "aud": aud,
            "iss": clientId,
            "sub": identity,
            "isAnonymous": isAnonymous
        }
        var headers = {};
        if(fName || lName) {
        headers.header = {
        "fName" : fName,
        "lName" : lName
        } 
        }
        var token = jwt.sign(options, clientSecret, headers);
        res.header("Access-Control-Allow-Origin","*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.header("Referrer-Policy","origin-when-cross-origin, strict-origin-when-cross-origin");
	res.header("Content-Security-Policy","default-src 'none'");
        res.send({"jwt":token});
        });


    app.post(apiPrefix+'/sendToBotUser', function(req, res) {
        var reqBody     = req.body;
        console.log("IN sendToBotUser API", reqBody);
        livechat.sendMessagetoBotUser(req, res);
        res.send("FINISHED");
        
        });
}


module.exports = {
    load : loadroutes
};
