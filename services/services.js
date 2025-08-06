// services/jobService.js
import axios from 'axios';
import Job from '../models/jobsmodel.js';
import { generateFromGemini } from './geminiClient.js';
import nodemailer from 'nodemailer';
import excel from 'excel4node';

const RAPIDAPI_URL = 'https://linkedin-job-search-api.p.rapidapi.com/active-jb-24h';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'ea195ee57fmshb206a1068b7dd6cp123faejsn09f394d5aace';
const RAPIDAPI_HOST = 'linkedin-job-search-api.p.rapidapi.com';

// Fetch jobs from RapidAPI
export const fetchJobsFromAPI = async (titleFilter = 'data analyst', locationFilter = 'bangalore') => {
  try {
    const options = {
      method: 'GET',
      url: RAPIDAPI_URL,
      params: {
        limit: '10',
        offset: '0',
        title_filter: `"${titleFilter}"`,
        location_filter: `"${locationFilter}"`,
        f_EL: '1',
        f_E: '1',
        experience_level: 'entry_level',
        seniority: 'internship,entry_level'
      },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching entry-level jobs:', error);
    throw new Error(`Failed to fetch entry-level jobs: ${error.message}`);
  }
};

// Create Excel sheet from job data
const createExcelSheet = (jobs, sheetName = 'Jobs Data') => {
  try {
    const wb = new excel.Workbook();
    const ws = wb.addWorksheet(sheetName);

    // Header style
    const headerStyle = wb.createStyle({
      font: { bold: true, color: 'white' },
      fill: { type: 'pattern', patternType: 'solid', fgColor: '4F81BD' }
    });

    // Get all unique keys from all jobs for headers
    const allKeys = new Set();
    jobs.forEach(job => {
      Object.keys(job).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);

    // Write headers
    headers.forEach((header, i) => {
      ws.cell(1, i + 1).string(header).style(headerStyle);
    });

    // Write data rows
    jobs.forEach((job, rowIndex) => {
      headers.forEach((header, colIndex) => {
        const cellValue = job[header];
        const cell = ws.cell(rowIndex + 2, colIndex + 1);
        
        if (cellValue === undefined || cellValue === null) {
          cell.string('N/A');
        } else if (typeof cellValue === 'string') {
          cell.string(cellValue);
        } else if (typeof cellValue === 'number') {
          cell.number(cellValue);
        } else if (typeof cellValue === 'boolean') {
          cell.bool(cellValue);
        } else if (Array.isArray(cellValue)) {
          cell.string(JSON.stringify(cellValue));
        } else if (typeof cellValue === 'object') {
          cell.string(JSON.stringify(cellValue));
        } else {
          cell.string(String(cellValue));
        }
      });
    });

    // Auto-size columns
    headers.forEach((_, i) => {
      ws.column(i + 1).setWidth(20);
    });

    return wb;
  } catch (error) {
    console.error('Error creating Excel sheet:', error);
    throw error;
  }
};

// Send email with Excel attachment
const sendEmailWithAttachment = async (subject, text, excelBuffer, filename) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'yeddulajagadeesh11@gmail.com',
        pass: 'jjdr ktbr ahfl qqmu'
      }
    });

    const emailList = ['gurramharika13@gmail.com', 'jaggujagadesh85@gmail.com'];

    for (const email of emailList) {
      await transporter.sendMail({
        from: 'yeddulajagadeesh11@gmail.com',
        to: email,
        subject,
        text,
        attachments: [{
          filename,
          content: excelBuffer
        }]
      });
    }
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

// Manual job mapping as fallback
const manualJobMapping = (apiJob) => {
  const employmentType = apiJob.employment_type?.[0] || 'FULL_TIME';
  const seniority = apiJob.seniority || 'Mid-Senior level';

  const extractApplyLink = (job) => {
    return job.url ||
      job.orgLink ||
      job.applyUrl ||
      job.apply_link ||
      job.applicationUrl ||
      job.application_url ||
      job.linkedinUrl ||
      job.linkedin_url ||
      job.externalUrl ||
      job.external_url ||
      job.jobUrl ||
      job.job_url ||
      `https://www.linkedin.com/jobs/view/${job.id}` ||
      '';
  };

  return {
    title: apiJob.title || 'No title provided',
    description: apiJob.linkedin_org_description ||
      `${apiJob.organization || 'Company'} is hiring for ${apiJob.title || 'a position'}` ||
      'No description provided',
    location: apiJob.locations_derived?.[0] ||
      apiJob.cities_derived?.[0] ||
      apiJob.countries_derived?.[0] ||
      'Remote',
    type: mapEmploymentType(employmentType),
    minsalaryrange: apiJob.salary_raw?.value?.minValue || 50000,
    maxsalaryrange: apiJob.salary_raw?.value?.maxValue || 100000,
    requiredexperience: mapSeniority(seniority),
    requireddegree: [],
    company: apiJob.organization || 'Unknown company',
    shifts: 'Day',
    requiredskills: extractSkills(apiJob),
    applyLink: extractApplyLink(apiJob),
    url: apiJob.url || '',
    remote: apiJob.remote_derived || false,
    postedDate: apiJob.date_posted ? new Date(apiJob.date_posted) : new Date(),
    source: 'linkedin'
  };
};

// Process job with Gemini AI
export const processJobWithAI = async (apiJob) => {
  try {
    const prompt = `Convert this LinkedIn job to standardized format with all required fields: ${JSON.stringify(apiJob)}. 
    Required fields: title, description, location, type (Full Time/Part Time/Internship), 
    minsalaryrange (number), maxsalaryrange (number), requiredexperience (text), 
    company (text), shifts (Day/Night/Both), applyLink (string).
    
    For applyLink, look for these fields in order: url, orgLink, applyUrl, apply_link, applicationUrl, 
    application_url, linkedinUrl, linkedin_url, externalUrl, external_url, jobUrl, job_url.
    If none found, use: "https://www.linkedin.com/jobs/view/[job_id]" or empty string.
    
    Return only valid JSON.`;

    const aiResponse = await generateFromGemini(prompt);

    if (!aiResponse) {
      return manualJobMapping(apiJob);
    }

    let cleanedResponse = aiResponse.replace(/^```(json)?/, '').replace(/```$/, '').trim();

    try {
      const parsedJob = JSON.parse(cleanedResponse);

      const requiredFields = ['title', 'description', 'location', 'type',
        'minsalaryrange', 'maxsalaryrange', 'requiredexperience',
        'company', 'shifts'];

      for (const field of requiredFields) {
        if (!parsedJob[field]) {
          console.warn(`AI response missing ${field}, falling back to manual mapping`);
          return manualJobMapping(apiJob);
        }
      }

      if (!parsedJob.applyLink) {
        const manualMapped = manualJobMapping(apiJob);
        parsedJob.applyLink = manualMapped.applyLink;
      }

      return parsedJob;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return manualJobMapping(apiJob);
    }
  } catch (error) {
    console.error('Error in processJobWithAI:', error);
    return manualJobMapping(apiJob);
  }
};

// Save job to database
export const saveJobToDB = async (jobData, userId = null) => {
  try {
    const requiredFields = ['title', 'description', 'location', 'type',
      'minsalaryrange', 'maxsalaryrange', 'requiredexperience',
      'company', 'shifts', 'applyLink'];

    for (const field of requiredFields) {
      if (!jobData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const existingJob = await Job.findOne({
      title: jobData.title,
      company: jobData.company,
      location: jobData.location
    });

    if (existingJob) {
      return { job: existingJob, isNew: false };
    }

    const newJob = new Job({
      title: jobData.title,
      description: jobData.description,
      location: jobData.location,
      type: jobData.type,
      minsalaryrange: jobData.minsalaryrange,
      maxsalaryrange: jobData.maxsalaryrange,
      requiredexperience: jobData.requiredexperience,
      requireddegree: jobData.requireddegree || [],
      company: jobData.company,
      shifts: jobData.shifts,
      requiredskills: jobData.requiredskills || [],
      applyLink: jobData.applyLink,
      userid: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newJob.save();
    return { job: newJob, isNew: true };
  } catch (error) {
    console.error('Error saving job to DB:', error);
    throw error;
  }
};

// Main function to fetch, process, and store jobs
export const fetchProcessAndStoreJobs = async (userId = null) => {
  try {
    const apiJobs = await fetchJobsFromAPI();
    const results = [];
    const newJobs = [];

    // 1. Send raw data as Excel
    try {
      const rawExcelWorkbook = createExcelSheet(apiJobs, 'Raw Jobs Data');
      const rawExcelBuffer = await rawExcelWorkbook.writeToBuffer();
      await sendEmailWithAttachment(
        `Raw Job Data from API (${apiJobs.length} positions)`,
        'Attached is the raw job data fetched from the API.',
        rawExcelBuffer,
        'raw_job_data.xlsx'
      );
    } catch (emailError) {
      console.error('Failed to send raw data email:', emailError);
    }

    // 2. Process jobs
    for (const apiJob of apiJobs) {
      try {
        let processedJob = manualJobMapping(apiJob);

        try {
          const aiProcessed = await processJobWithAI(apiJob);
          processedJob = { ...processedJob, ...aiProcessed };
        } catch (aiError) {
          console.warn('AI processing failed, using manual mapping:', aiError);
        }

        const { job, isNew } = await saveJobToDB(processedJob, userId);
        results.push({ job, isNew, success: true });

        if (isNew) {
          newJobs.push(job);
        }
      } catch (jobError) {
        console.error(`Error processing job ${apiJob.id || 'unknown'}:`, jobError);
        results.push({
          job: apiJob,
          isNew: false,
          success: false,
          error: jobError.message
        });
      }
    }

    // 3. Send processed data
    if (newJobs.length > 0) {
      try {
        const processedExcelWorkbook = createExcelSheet(
          newJobs.map(job => job.toObject()),
          'Processed Jobs Data'
        );
        const processedExcelBuffer = await processedExcelWorkbook.writeToBuffer();

        let jobsHtml = newJobs.map(job => `
          <div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 20px;">
            <h2 style="color: teal;">${job.title}</h2>
            <p><strong>Company:</strong> ${job.company}</p>
            <p><strong>Location:</strong> ${job.location}</p>
            <p><strong>Description:</strong> ${job.description.substring(0, 200)}...</p>
            <p><strong>Apply Link:</strong> <a href="${job.applyLink}">${job.applyLink}</a></p>
          </div>
        `).join('');

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'yeddulajagadeesh11@gmail.com',
            pass: 'jjdr ktbr ahfl qqmu'
          }
        });

        const emailList = ['gurramharika13@gmail.com', 'jaggujagadesh85@gmail.com'];

        for (const email of emailList) {
          await transporter.sendMail({
            from: 'yeddulajagadeesh11@gmail.com',
            to: email,
            subject: `Processed Job Listings (${newJobs.length} positions)`,
            html: `
              <h1 style="color: teal;">Processed Job Opportunities</h1>
              <p>Here are ${newJobs.length} new job positions that might interest you:</p>
              ${jobsHtml}
              <p style="margin-top: 20px;">Good luck with your applications!</p>
            `,
            attachments: [{
              filename: 'processed_job_data.xlsx',
              content: processedExcelBuffer
            }]
          });
        }
      } catch (error) {
        console.error('Failed to send processed data email:', error);
      }
    }

    return results;
  } catch (error) {
    console.error('Error in fetchProcessAndStoreJobs:', error);
    throw error;
  }
};

// Helper functions
const mapEmploymentType = (type) => {
  if (!type) return 'Full Time';
  const mapping = {
    'FULL_TIME': 'Full Time',
    'PART_TIME': 'Part Time',
    'CONTRACTOR': 'Contract',
    'INTERN': 'Internship',
    'TEMPORARY': 'Contract'
  };
  return mapping[type.toUpperCase()] || 'Full Time';
};

const mapSeniority = (seniority) => {
  if (!seniority) return '2-5 years';
  const mapping = {
    'INTERNSHIP': '0 years',
    'ENTRY_LEVEL': '0-2 years',
    'ASSOCIATE': '1-3 years',
    'MID_SENIOR': '3-5 years',
    'SENIOR': '5+ years',
    'DIRECTOR': '10+ years',
    'EXECUTIVE': '15+ years'
  };
  return mapping[seniority.toUpperCase().replace(/\s+/g, '_')] || '2-5 years';
};

const extractSkills = (job) => {
  const skills = [];
  if (job.title?.includes('Java')) skills.push('Java');
  if (job.title?.includes('React')) skills.push('React');
  if (job.linkedin_org_specialties) {
    skills.push(...job.linkedin_org_specialties.filter(s => s && s.length < 20));
  }
  return Array.from(new Set(skills)).slice(0, 5);
};