import { readFileSync } from 'fs'

const data = readFileSync('./config.json', 'utf-8')
const config = JSON.parse(data)
const token = config.token

async function fetchWebApi(endpoint, method, body) {
	const res = await fetch(`https://api.spotify.com/${endpoint}`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
		method,
		body:JSON.stringify(body)
	});
	return await res.json();
}

async function getTopTracks(){
	// Endpoint reference : https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
	return (await fetchWebApi(
		'v1/me/top/tracks?time_range=long_term&limit=5', 'GET'
	)).items;
}

const topTracks = await getTopTracks();
console.log(
	topTracks?.map(
		({name, artists}) =>
			`${name} by ${artists.map(artist => artist.name).join(', ')}`
	)
);
