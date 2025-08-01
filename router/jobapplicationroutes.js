import express from 'express'

const router=express.Router();
import {applyjob, getapplicationofparticularjob, getapplicationsoflogineduser} from '../controller/jobapplicationcontroller.js';


router.post('/apply/:jobid/:userid',applyjob);
router.get('/applications/:userid',getapplicationsoflogineduser);
router.get('/applicationsbyjobid/:jobid',getapplicationofparticularjob);

export default router