const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const axios = require('axios');
require('dotenv').config();

// Twitter API credentials for the first account
const client1 = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY1,
  appSecret: process.env.TWITTER_APP_SECRET1,
  accessToken: process.env.TWITTER_ACCESS_TOKEN1,
  accessSecret: process.env.TWITTER_ACCESS_SECRET1,
});

// Twitter API credentials for the second account
const client2 = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY2,
  appSecret: process.env.TWITTER_APP_SECRET2,
  accessToken: process.env.TWITTER_ACCESS_TOKEN2,
  accessSecret: process.env.TWITTER_ACCESS_SECRET2,
});

const rwClient1 = client1.readWrite;
const rwClient2 = client2.readWrite;
const botUserId1 = '1736098016673857536'; // Replace with your first bot's user ID
const botUserId2 = '1156187150'; // Replace with your second bot's user ID

// NewsData.io API credentials
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Set to store posted article titles to avoid repeats
const postedArticles = new Set();

// Array to cycle through different categories and regions
const countriesAndCategories = [
  { country: 'us', category: 'top' },
  { country: 'us', category: 'business' },
  { country: 'us', category: 'entertainment' },
  { country: 'us', category: 'health' },
  { country: 'us', category: 'science' },
  { country: 'us', category: 'sports' },
  { country: 'us', category: 'technology' },
  { country: 'za', category: 'top' },
  { country: 'ng', category: 'top' },
  { country: 'ke', category: 'top' },
];
let currentIndex = 0;

// Track the number of requests made to NewsData.io
let newsApiRequestsMade = 0;
const NEWS_API_REQUEST_LIMIT = 200;

// Function to log in to Twitter and confirm credentials
async function loginToTwitter() {
  try {
    console.log('Logging into Twitter...');
    const me1 = await rwClient1.v2.me();
    console.log(`Logged in as @${me1.data.username} (Account 1)`);

    const me2 = await rwClient2.v2.me();
    console.log(`Logged in as @${me2.data.username} (Account 2)`);
  } catch (error) {
    console.error('Error logging into Twitter:', error);
  }
}

// Function to get breaking news articles from NewsData.io
async function getBreakingNews(country = 'us', category = 'top') {
  if (newsApiRequestsMade >= NEWS_API_REQUEST_LIMIT) {
    console.log('Reached NewsData.io API request limit for the day.');
    return [];
  }

  console.log(`Fetching the latest breaking news for country: ${country}, category: ${category}...`);
  try {
    const response = await axios.get(`https://newsdata.io/api/1/news?apikey=${NEWS_API_KEY}&country=${country}&category=${category}`, { timeout: 10000 });
    console.log('News fetched successfully.');
    newsApiRequestsMade++;
    return response.data.results;
  } catch (error) {
    console.error('Error fetching news:', error.response ? error.response.data : error.message);
    return [];
  }
}

// Function to format a string as a hashtag
function formatAsHashtag(string) {
  return string.replace(/\s+/g, '').replace(/[^\w]/g, '');
}

// Function to format the tweet text
function formatTweetText(article) {
  // Map categories to hashtags
  const categoryHashtags = {
    general: 'GeneralNews',
    business: 'BusinessNews',
    entertainment: 'EntertainmentNews',
    health: 'HealthNews',
    science: 'ScienceNews',
    sports: 'SportsNews',
    technology: 'TechNews',
    africa: 'AfricaNews'
  };

  // Ensure the category is a string and convert to lowercase
  const category = typeof article.category === 'string' ? article.category.toLowerCase() : 'general';
  const hashtag = categoryHashtags[category] || 'News';

  // Format the news outlet name as a hashtag
  const outletHashtag = `#${formatAsHashtag(article.source_id || 'UnknownSource')}`;

  // Make the first two words in the title a single hashtag
  const titleWords = article.title.split(' ');
  const firstTwoHashtags = `#${formatAsHashtag(titleWords.slice(0, 2).join(' '))}`;

  // Construct the tweet text with two-line space before "READ HERE"
  const status = `${firstTwoHashtags} ${titleWords.slice(2).join(' ')}\n#${hashtag} ${outletHashtag}\n\nREAD HERE: ${article.link} cashapp:$KBKNY`;
  return status;
}

// Function to post a tweet and return the tweet ID
async function postTweet(status) {
  console.log('Attempting to post a tweet:', status);
  try {
    const response1 = await rwClient1.v2.tweet(status);
    console.log('Tweet posted successfully on Account 1:', response1.data);

    const response2 = await rwClient2.v2.tweet(status);
    console.log('Tweet posted successfully on Account 2:', response2.data);

    return response1.data.id; // Return the tweet ID from the first account
  } catch (error) {
    console.error('Error posting tweet:', error.response?.data || error.message);
    if (error.response?.data?.title === 'Too Many Requests') {
      console.error('Rate limit exceeded. Waiting before retrying...');
      const resetTime = error.response.headers['x-rate-limit-reset'];
      const resetDate = new Date(resetTime * 1000);
      console.log(`Next request can be made after ${resetDate}`);
    } else if (error.response?.data?.title === 'Client Forbidden') {
      console.error('API keys not properly enrolled in a Twitter Developer App project. Please check your project setup.');
    }
    return null;
  }
}

// Function to follow a user by their user ID
async function followUser(userId) {
  try {
    await rwClient1.v2.follow(botUserId1, userId);
    console.log(`Followed user with ID: ${userId} (Account 1)`);

    await rwClient2.v2.follow(botUserId2, userId);
    console.log(`Followed user with ID: ${userId} (Account 2)`);
  } catch (error) {
    console.error('Error following user:', error);
  }
}

// Function to handle interactions with a tweet
async function handleTweetInteractions(tweetId) {
  try {
    const likes1 = await rwClient1.v2.tweetLikedBy(tweetId);
    for (const user of likes1.data) {
      await followUser(user.id);
    }

    const likes2 = await rwClient2.v2.tweetLikedBy(tweetId);
    for (const user of likes2.data) {
      await followUser(user.id);
    }

    const retweets1 = await rwClient1.v2.tweetRetweetedBy(tweetId);
    for (const user of retweets1.data) {
      await followUser(user.id);
    }

    const retweets2 = await rwClient2.v2.tweetRetweetedBy(tweetId);
    for (const user of retweets2.data) {
      await followUser(user.id);
    }

    const replies1 = await rwClient1.v2.search(`conversation_id:${tweetId}`);
    for (const user of replies1.data) {
      await followUser(user.author_id);
    }

    const replies2 = await rwClient2.v2.search(`conversation_id:${tweetId}`);
    for (const user of replies2.data) {
      await followUser(user.author_id);
    }
  } catch (error) {
    console.error('Error handling tweet interactions:', error);
  }
}

// Function to find the next available article to post
async function findAndPostArticle() {
  while (currentIndex < countriesAndCategories.length) {
    const { country, category } = countriesAndCategories[currentIndex];
    currentIndex = (currentIndex + 1) % countriesAndCategories.length; // Update the index for the next call

    const news = await getBreakingNews(country, category);
    for (const article of news) {
      if (!postedArticles.has(article.title)) {
        const status = formatTweetText(article);
        const tweetId = await postTweet(status);
        if (tweetId) {
          postedArticles.add(article.title);
          setTimeout(() => handleTweetInteractions(tweetId), 60 * 60 * 1000); // Handle interactions 1 hour after posting
        }
        return;
      }
    }
  }

  console.log('No new articles available to tweet.');
}

// Schedule tweets every 90 minutes
schedule.scheduleJob('*/90 * * * *', async () => {
  console.log('Scheduled tweet job triggered.');
  await findAndPostArticle();
});

// Poll for breaking news every 90 minutes to keep track of new articles
async function pollBreakingNews() {
  setInterval(async () => {
    console.log('Polling for breaking news...');
    await findAndPostArticle();
  }, 90 * 60 * 1000); // Every 90 minutes
}

async function startBot() {
  console.log('Starting Twitter bot...');
  await loginToTwitter();

  // Initial post to verify News API
  console.log('Making initial post to verify News API...');
  await findAndPostArticle();

  // Start polling for breaking news
  pollBreakingNews();

  console.log('Twitter bot is running and scheduled jobs are set.');
}

startBot();
