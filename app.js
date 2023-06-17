const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());

const app = express();
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  const { tweet } = request.body;
  const { tweetId } = request.params;
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.send(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.payload = payload;
        request.tweetId = tweetId;
        request.tweet = tweet;
        next();
      }
    });
  }
};

//API 1

app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const addUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  console.log(username, password, name, gender);
  const userUser = await db.get(addUserQuery);
  if (userUser !== undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `INSERT INTO user (username,password,name,gender) VALUES ('${username}','${hashedPassword}','${name}','${gender}');`;
      await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// API - 2

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const addUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  console.log(username, password);
  const userDetails = await db.get(addUserQuery);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbDetails.password
    );
    if (isPasswordMatched === true) {
      const jwtToken = jwt.sign(dbDetails, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API - 3

app.get("/user/tweets/feed", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const getTweetsQuery = `SELECT 
  username,
  tweet,
  date_time AS dateTime
       FROM follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id
       INNER JOIN user ON user.user_id = follower.following_user_id
       WHERE follower.follower_user_id = ${user_id}
       ORDER BY
        date_time DESC
       LIMIT 4;`;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

// API - 4

app.get("/user/following", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const getUsersFollowingQuery = `SELECT name FROM user
    INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE follower.follower_user_id = ${user_id};`;
  const followingDetails = await db.all(getUsersFollowingQuery);
  response.send(followingDetails);
});

// API - 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const getUserFollowersQuery = `SELECT name FROM user
    INNER JOIN follower ON user.user_id = follower.follower_user_id
    WHERE follower.following_user_id = ${user_id};`;
  const followerDetails = await db.all(getUserFollowersQuery);
  response.send(followerDetails);
});

// API - 6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, tweetId);
  const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const tweetsResult = await db.get(tweetsQuery);
  const getTweetQuery = `SELECT *
     FROM follower INNER JOIN user ON user.user_id=follower.following_user_id
     WHERE follower.follower_user_id = ${user_id}`;
  const tweets = await db.all(getTweetQuery);
  if (tweets.some((item) => item.following_user_id === tweetsResult.user_id)) {
    console.log(tweetsResult);
    console.log("------------");
    console.log(tweets);
    const getTweetDetailsQuery = `SELECT tweet ,
      COUNT(DISTINCT(like.like_id)) AS likes,
      COUNT(DISTINCT(reply.reply_id)) AS replies,
      tweet.date_time AS dateTime
      FROM
      tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
      WHERE 
      tweet.tweet_id = ${tweetId} AND tweet.user_id = ${tweets[0].user_id};`;
    const tweetDetails = await db.get(getTweetDetailsQuery);
    response.send(tweetDetails);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

// API - 7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const getLikesQuery = `SELECT * FROM follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id
    INNER JOIN user ON user.user_id = like.user_id
    WHERE
    tweet.tweet_id=${tweetId} AND follower.follower_user_id=${user_id};`;
    const likedUser = await db.all(getLikesQuery);
    console.log(likedUser);
    if (likedUser.length !== 0) {
      let likes = [];
      const getNamesArray = (likedUser) => {
        for (let item of likedUser) {
          likes.push(item.username);
        }
      };
      getNamesArray(likedUser);
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// API - 8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const getRepliedQuery = `SELECT * FROM follower
    INNER JOIN tweet ON tweet.tweet_id = follower.following_user_id INNER JOIN reply ON  reply.tweet_id = tweet.tweet_id
    INNER JOIN user on user.user_id = reply.user_id
    WHERE
    tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id};`;
    const repliedUser = await db.all(getRepliedQuery);
    console.log(repliedUser);
    if (repliedUser !== 0) {
      let replies = [];
      const getNamesArray = (repliedUser) => {
        for (let item of repliedUser) {
          let object = {
            name: item.name,
            reply: item.reply,
          };
          replies.push(object);
        }
      };
      getNamesArray(repliedUser);
      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// API - 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, user_id);
  const getTweetsQuery = `SELECT tweet.tweet AS tweet,
    COUNT(DISTINCT (like.like_id)) AS likes,
    COUNT(DISTINCT (reply.reply_id)) AS replies,
    tweet.date_time AS dateTime
    FROM user LEFT JOIN tweet ON user.user_id = tweet.user_id 
    INNER JOIN like ON tweet.tweet_id = like.tweet_id
    INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
    WHERE user.user_id = ${user_id}
    GROUP BY tweet.tweet_id;`;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

// API - 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request;
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, tweetId);
  const createUserQuery = `INSERT INTO tweet (tweet,user_id)
        VALUES ('${tweet}','${user_id}');`;
  await db.run(createUserQuery);
  response.send("Created a Tweet");
});

// API - 11

app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const getTweetQuery = `SELECT * FROM tweet WHERE tweet.user_id = '${user_id}' AND tweet.tweet_id = ${tweetId};`;
  const tweet = await db.get(getTweetQuery);
  console.log(tweet);
  if (tweet.length !== 0) {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet.user_id =${user_id} AND tweet.tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
