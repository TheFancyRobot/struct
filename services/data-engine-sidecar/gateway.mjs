import { connect, createServer } from 'node:net'

const server = createServer((client) => {
  const upstream = connect({ host: 'data-engine', port: 4300 })
  client.pipe(upstream)
  upstream.pipe(client)
  const close = () => {
    client.destroy()
    upstream.destroy()
  }
  client.on('error', close)
  upstream.on('error', close)
})

server.listen(4300, '0.0.0.0')
