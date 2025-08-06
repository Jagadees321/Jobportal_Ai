import axios from 'axios';

const options = {
  method: 'GET',
  url: 'https://jsearch.p.rapidapi.com/search',
  params: {
    query: 'full stack jobs in bangalore',
    page: '1',
    num_pages: '18',
    country: 'india',
    date_posted: 'today'
  },
  headers: {
    'x-rapidapi-key': 'fd8b700d45msh6da6a7a6e0847bbp192519jsn295fb4da44bc',
    'x-rapidapi-host': 'jsearch.p.rapidapi.com'
  }
};

try {
	const response = await axios.request(options);
	console.log(response.data);
} catch (error) {
	console.error(error);
}