const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const { exec } = require("child_process");

const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// =========================
// Helpers
// =========================
function serialize(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

function deserialize(str) {
  return JSON.parse(Buffer.from(str, "base64").toString());
}

// =========================
// Fake DB
// =========================
const USERS = [
  { email: "admin@gmail.com", password: "0123", role: "user" }
];

// 🚩 FLAG
const FLAG = "CTF{cookie_chain_to_rce_simulation}";

// =========================
// SAFE COMMAND RUNNER
// =========================
function runCommandSafe(input, callback) {
  exec(input, (err, stdout, stderr) => {
    if (err) return callback("Execution error");
    callback(null, stdout);
  });
}

// =========================
// Routes
// =========================

// Login page
app.get("/", (req, res) => {
  res.send(`
    <h2>Login</h2>
    <form method="POST" action="/login">
      <input name="email" placeholder="email"/><br/>
      <input name="password" type="password" placeholder="password"/><br/>
      <button>Login</button>
    </form>
  `);
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = USERS.find(
    u => u.email === email && u.password === password
  );

  if (!user) return res.send("Invalid login");

  const session = {
    username: email,
    role: user.role
  };

  res.cookie("session", serialize(session));
  res.redirect("/dashboard");
});

// Dashboard
app.get("/dashboard", (req, res) => {
  const session = req.cookies.session;
  if (!session) return res.send("Not logged in");

  try {
    const data = deserialize(session);

    let output = `<h2>Welcome ${data.username}</h2>`;
    output += `<p>Role: ${data.role}</p>`;

    if (data.role === "admin") {
      output += `<a href="/admin">Admin Panel</a>`;
    }

    res.send(output);

  } catch {
    res.send("Invalid cookie");
  }
});

// =========================
// In-memory user settings
// =========================
let userSettings = {};

// =========================
// Vulnerable deep merge (realistic)
// =========================
function deepMerge(target, source) {
  for (let key in source) {
    if (typeof source[key] === "object" && source[key] !== null) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// =========================
// Profile Update (REALISTIC SINK)
// =========================
app.post("/api/profile/update", (req, res) => {
  const session = req.cookies.session;
  if (!session) return res.send("Not logged in");

  try {
    const data = deserialize(session);

    if (!userSettings[data.username]) {
      userSettings[data.username] = {
        theme: "light",
        notifications: true
      };
    }

    // 🚨 VULNERABLE: deep merge user input
    deepMerge(userSettings[data.username], req.body);

    res.send({
      status: "updated",
      settings: userSettings[data.username]
    });

  } catch {
    res.send("Error");
  }
});

// Admin Panel
app.get("/admin", (req, res) => {
  const session = req.cookies.session;
  if (!session) return res.send("No session");

  try {
    const data = deserialize(session);
    const settings = userSettings[data.username] || {};

    // 🧬 Pollution now affects logic indirectly
    if (settings.isAdmin || data.role === "admin") {
      return res.send(`
        <h2>Admin Panel</h2>
        <p>Welcome ${data.username}</p>
        <p>Debug mode: ${settings.execMode || "off"}</p>
        <p>Try /debug?cmd=whoami</p>
      `);
    }

    if (!data.role) return res.send("No role");

    // Step 2: command trigger (previous logic retained)
    if (data.role.startsWith("cmd:")) {
      const cmd = data.role.replace("cmd:", "");

      runCommandSafe(cmd, (err, result) => {
        if (err) return res.send(err);

        res.send(`
          <h2>Command Output</h2>
          <p>Command: ${cmd}</p>
          <pre>${result}</pre>
        `);
      });

    } else {
      res.send("Access denied");
    }

  } catch {
    res.send("Error");
  }
});

app.get("/debug", (req, res) => {
  const session = req.cookies.session;
  if (!session) return res.send("No session");

  try {
    const data = deserialize(session);
    const settings = userSettings[data.username] || {};

    // 🚨 Only enabled via polluted config
    if (!settings.execMode) {
      return res.send("Debug disabled");
    }

    const cmd = req.query.cmd;

    if (!cmd) return res.send("No command");

    runCommandSafe(cmd, (err, result) => {
      if (err) return res.send(err);

      res.send(`
        <h3>Debug Output</h3>
        <pre>${result}</pre>
      `);
    });

  } catch {
    res.send("Error");
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});