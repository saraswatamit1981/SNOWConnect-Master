var Promise  = require('bluebird');
var config = require('./config.json');
var redis = require("./lib/RedisClient.js").createClient(config.redis);


function updateRedisWithData(visitorId,data) {
	return new Promise(function(resolve, reject){
		redis.hmset("data:"+visitorId, 'visitorID',visitorId,'time',new Date(), 'data', JSON.stringify(data), function(err,reply){
		console.log('Inserted Data --------',reply);
		resolve(reply);
	});
	})
	
}
function updateRedisWithEntry(visitorId,groupId,entry) {
	return new Promise(function(resolve, reject){
		redis.hmset("user:"+visitorId, 'visitorID',visitorId, 'groupId',groupId, 'time',new Date(), 'data', JSON.stringify(entry), function(err,reply){
		console.log('Inserted Entry --------',reply);
		resolve(reply);
	});
	})	
}

function setTtl(visitorOrGroupId,hashType){
	redis.expire(hashType+':'+visitorOrGroupId, 28800);
	console.log("Inserted successfully");
}

function getRedisData(key) {
		return new Promise(
        function (resolve, reject) {
            	redis.hgetall(key, function(err,object){
			if(err)
				reject(err);
			else
				if(object)
					{
					resolve(JSON.parse(object.data));
					}
				else
					resolve(undefined);
        }); 
});
}

function getRedisDataId(key) {
		return new Promise(
        function (resolve, reject) {
            	redis.hgetall(key, function(err,object){
			if(err)
				reject(err);
			else
				if(object)
					{
					resolve(object);
					}
				else
					resolve(undefined);
        }); 
	});
}

function getRedisTTL(key) {
		return new Promise(
        function (resolve, reject) {
            	redis.ttl(key, function(err,object){
			if(err)
				reject(err);
			else
				if(object)
					{
					resolve(object);
					}
				else
					resolve(undefined);
        }); 
	});
}

function updateRedisById(key) {
	return new Promise(function (resolve, reject) {
		redis.expire(key, 28800, function(err,data){
			resolve(data);
		});
	});
}

function deleteRedisData(key,type)
{	
	redis.del(key, function(err,reply){
	console.log('deleted data --------',reply);
});
}
module.exports.updateRedisWithData = updateRedisWithData;
module.exports.updateRedisWithEntry = updateRedisWithEntry;
module.exports.getRedisData = getRedisData;
module.exports.deleteRedisData = deleteRedisData;
module.exports.setTtl = setTtl;
module.exports.getRedisDataId = getRedisDataId;
module.exports.getRedisTTL = getRedisTTL;
module.exports.updateRedisById = updateRedisById;