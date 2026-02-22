# speed-watches
A league api webhook that saves game information to mongodb

## How does speed-watches work?
Speed-watches contains an endpoint that makes an api call to the [league api](https://developer.riotgames.com/apis) and saves game information depending on if the game is already saved within the db or not.

The program is deployed to vercel, which has a set cron-job running the endpoint that checks a for a list players and the games they have recently played. If any of these games are missing in the database, the missing game is added. 

## What is speed-watches for?
speed watches creates a mongodb database containing the information of players' games. This information is connected to an entity that users can add notes to, which can be querried by other users if the matchup is favorable or not. 

## How do I use the database?
Ask me for the connection uri and use mongodb to access data. Speedwatches does not double as an api for the created database, but it can be if there is demand for it to be. 

## How do I contribute?
To contribute, contact me on discord: lorgborg. There's lots to contribute to too! Examples are:
- front-end distribution (we'll need LOTS of help here!)
- transforming speed-watches as an api for the database
- documentation