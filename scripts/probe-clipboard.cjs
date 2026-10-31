const { app, clipboard } = require('electron')

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const out = { keys: Object.keys(clipboard), items: [] }
  try {
    const items = await clipboard.read()
    for (const it of items) {
      const entry = { types: it.types, payloads: {} }
      for (const t of it.types) {
        try {
          const v = await it.getType(t)
          if (typeof v === 'string') entry.payloads[t] = `string(${v.length}): ${v.slice(0, 160)}`
          else if (v && v.arrayBuffer) {
            if (/text\/|osclipboard/.test(v.type)) {
              const txt = Buffer.from(await v.arrayBuffer()).toString('utf8')
              entry.payloads[t] = `blob(${v.size}) ${JSON.stringify(txt.slice(0, 200))}`
            } else {
              entry.payloads[t] = `${v.constructor.name} size=${v.size} type=${v.type}`
            }
          } else entry.payloads[t] = JSON.stringify(v).slice(0, 200)
        } catch (e) {
          entry.payloads[t] = `ERR ${e.message}`
        }
      }
      out.items.push(entry)
    }
    out.readText = (await clipboard.readText()).slice(0, 120)
  } catch (e) {
    out.error = e.message
  }
  console.log(JSON.stringify(out, null, 2))
  app.quit()
})
