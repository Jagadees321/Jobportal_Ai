
import express from 'express'

const router=express.Router();
import {register} from '../controller/usercontroller.js'
router.post('/register',register);


export default router