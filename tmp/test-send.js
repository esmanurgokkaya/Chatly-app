const fs = require('fs')
const fetch = require('node-fetch')
const FormData = require('form-data')

async function main() {
  const fd = new FormData()
  fd.append('image', fs.createReadStream(__dirname + '/fake-image.jpg'))
  fd.append('text', 'kk')

  const res = await fetch('http://localhost:3001/api/messages/send/68e9043f11f81815fa189e17', {
    method: 'POST',
    body: fd,
    headers: fd.getHeaders(),
    credentials: 'include'
  })

  console.log('status', res.status)
  const txt = await res.text()
  console.log('body', txt)
}

main().catch(console.error)
