# 🧠 Memory Compaction Simulator

An interactive, web-based **Memory Compaction Simulator** that visually demonstrates how an Operating System manages memory using **First-Fit allocation**, **external fragmentation**, and **memory compaction**.

---

## 📸 Preview

> Load the **Demo Scenario** to instantly see processes allocated with fragmented free holes, then hit **Compact Memory** to watch everything merge!

---

## 🚀 Features

- **Visual Memory Layout** – Real-time bar visualization of allocated processes and free holes
- **First-Fit Allocation** – Allocates each new process to the first hole large enough to fit it
- **Memory Compaction** – Merges all scattered free holes into one contiguous block
- **Step-by-Step Compaction** – Watch each process move one at a time with highlights
- **Auto-Compact & Retry** – If a process can't fit, the app offers to compact and retry automatically
- **Process Management** – Add or remove named processes dynamically
- **Duplicate Name Guard** – Prevents adding two processes with the same name
- **Random Fragmentation** – Randomly removes two processes to simulate holes
- **Live Statistics** – Used memory, free memory, fragmentation %, and hole count
- **Action Log** – Color-coded log of every operation
- **Demo Scenario** – One-click pre-loaded fragmented memory state

---

## 🛠 Tech Stack

| Layer        | Technology              |
|--------------|-------------------------|
| **Frontend** | HTML5, CSS3, JavaScript |
| **UI Framework** | Bootstrap 5         |
| **Backend**  | Node.js + Express.js    |
| **API**      | RESTful JSON API        |
| **Rendering**| DOM manipulation        |

---

## 📁 Project Structure

```
Memory-Compaction-Simulator/
├── public/
│   ├── index.html       # Main UI page
│   ├── app.js           # Frontend logic (API calls, rendering)
│   └── style.css        # Custom styles
├── server.js            # Express server + memory management API
├── package.json         # Node.js project config
└── README.md            # This file
```

---

## ⚙️ Installation & Running

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/ParthKinage/Memory-Compaction-Simulator.git

# 2. Navigate into the project folder
cd Memory-Compaction-Simulator

# 3. Install dependencies
npm install

# 4. Start the server
node server.js

# 5. Open your browser and visit
http://localhost:3000
```

---

## 🌐 API Endpoints

| Method | Endpoint                    | Description                            |
|--------|-----------------------------|----------------------------------------|
| GET    | `/api/memory-state`         | Get current memory layout and stats    |
| POST   | `/api/initialize`           | Initialize memory with optional processes |
| POST   | `/api/add-process`          | Add a new process (First-Fit)          |
| POST   | `/api/remove-process`       | Remove a process and free its memory   |
| POST   | `/api/compact`              | Run memory compaction                  |
| POST   | `/api/reset`                | Reset memory to empty state            |
| POST   | `/api/random-fragmentation` | Randomly remove 2 processes            |

---

## 🧩 Memory Management Concepts Demonstrated

- **External Fragmentation** – Free memory is split into non-contiguous holes
- **First-Fit Algorithm** – Allocates process to the first hole large enough
- **Compaction** – Moves all processes to one end, consolidating all free holes
- **Hole Coalescing** – Adjacent free holes are merged automatically after removal

---

## 👨‍💻 Author

**Parth Kinage**  
[GitHub: @ParthKinage](https://github.com/ParthKinage)

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
