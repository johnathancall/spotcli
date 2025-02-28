import { readFileSync } from 'fs'

const data = readFileSync('./config.json', 'utf-8')
const config = JSON.parse(data)
const token = config.token
const base_playlist_ids = config.base_playlist_ids

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

async function getBasePlaylistNames(){
	return await Promise.all(base_playlist_ids.map(async (id) => {
		let res = await fetchWebApi(`v1/playlists/${id}`, 'GET')
		return {id: id, name: res.name}
	}))
}

async function getPlaylistItems(playlist_id){
	return (await fetchWebApi(
		`v1/playlists/${playlist_id}/tracks`, 'GET'
	)).items
}

console.log(await getBasePlaylistNames())
