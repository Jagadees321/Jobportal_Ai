import express from "express";
import dotenv from "dotenv";
import connectdb from "./db/dbconnect.js";
import userrouter from './router/userroutes.js';
import jobrouter from './router/jobsroutes.js';
import jobapplictionrouter from './router/jobapplicationroutes.js';
import {fetchJobsFromAPI,
  processJobWithAI,
  saveJobToDB,
  fetchProcessAndStoreJobs} from './services/services.js';
import cors from 'cors';
import cron from 'node-cron'
const app = express();
dotenv.config();//load env variables
connectdb(); 
//MIDDLEWARES
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());
app.get('/',(req,res)=>{
    res.status(200).send("server is running fine");
})
app.get('/api/home',(req,res)=>{
    res.status(200).send("Home page route checking");
})
cron.schedule('* * * * *', async() => {
    
     const results = await fetchProcessAndStoreJobs('6889ee4896956f2ca0c9a512');
    console.log('running a task every 1 min');
})
//ROUTES
app.use('/api',userrouter)
app.use('/api',jobrouter)
app.use('/api',jobapplictionrouter)
let port=process.env.port || 5051;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
