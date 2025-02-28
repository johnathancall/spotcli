import { readFileSync } from 'fs'

const data = readFileSync('./config.json', 'utf-8')
const config = JSON.parse(data)
const token = config.token
const playlist_ids = config.playlist_ids

async function fetchWebApi(endpoint, method, body) {
	const res = await fetch(`https://api.spotify.com/${endpoint}`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
		method,
		body:JSON.stringify(body)
	})
	return await res.json()
}

async function getTopTracks(){
	// Endpoint reference : https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
	return (await fetchWebApi(
		'v1/me/top/tracks?time_range=long_term&limit=10', 'GET'
	)).items
}

async function getPlaylistItems(playlist_id){
	return (await fetchWebApi(
		`v1/playlists/${playlist_id}/tracks`, 'GET'
	)).items
}

const topTracks = await getTopTracks()
console.log(await getPlaylistItems(playlist_ids[0]))
