import usermodel from '../models/usermodel.js';


export const register=async(req,res)=>{
    try {
        const {username,email,password}=req.body;
        console.log(req.body);
        if(!username || !email || !password){
            return res.status(400).json({error:'email,username and password are required'});
        }
        const userexist=await usermodel.findOne({email});
        
        if(userexist){
            return res.status(400).json({error:'user already exist'});
        }
        let newuser=new usermodel(req.body);
        await newuser.save();
        return res.status(200).json({message:"user registered successfully",user:newuser});

    } catch (error) {
        return res.status(500).json({error:'internal server error'+error.message});
    }
}