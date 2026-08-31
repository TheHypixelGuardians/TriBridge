# Feature requests

```
/request
```

Opens a short form: a **name** for the feature and a **description** of what it should do and why. Submit it
and the bot posts it as an embed, with a number, in the server's feature-request channel.

- The name is 3–100 characters; the description is 10–1000.
- You get the request's number back in a private reply, so you can point at it later.
- Mentions in a request do not ping. `@everyone` in a description reaches the channel as text.

If the reply says no request channel is configured, ask an administrator to set one up.

## What happens to it

An admin moves the request through a status with `/requeststatus`, and the original embed is updated in place
— same message, new colour and label. So the channel is always the current state of every request rather than
a log of status changes.

| Status         | Means                                             |
|----------------|---------------------------------------------------|
| ⏳ Pending      | Nobody has looked at it yet — where every request starts |
| 📌 Planned     | Accepted, and on the list to build                |
| ✅ Accepted     | Agreed to                                         |
| ❌ Denied       | Not going to happen                               |
| 🔁 Duplicate   | Already requested — look for the earlier one       |

## Next

- [Commands](Commands)
- [Using the bridge](Using-the-Bridge)
