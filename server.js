const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let memoryState = {
  totalMemory: 1024,
  memory: [{
    id: `h_init_${Date.now()}`,
    type: "hole",
    name: "Free",
    startAddress: 0,
    size: 1024,
    color: "secondary"
  }]
};

function getStats() {
  const used = memoryState.memory.filter(b => b.type === 'process').reduce((sum, b) => sum + b.size, 0);
  const free = memoryState.totalMemory - used;
  const holes = memoryState.memory.filter(b => b.type === 'hole');
  let fragmentationPercentage = 0;
  if (free > 0 && holes.length > 1) {
    const largestHole = Math.max(...holes.map(h => h.size));
    fragmentationPercentage = ((free - largestHole) / free) * 100;
  }
  return {
    total: memoryState.totalMemory,
    used,
    free,
    fragmentationPercentage: fragmentationPercentage.toFixed(1),
    holesCount: holes.length
  };
}

// 1. POST /api/initialize
app.post('/api/initialize', (req, res) => {
  const { totalMemory, processes } = req.body;
  memoryState.totalMemory = totalMemory || 1024;
  memoryState.memory = [];
  
  let currentAddress = 0;
  const colors = ["primary", "success", "warning", "info", "danger", "dark"];
  
  if (processes && processes.length > 0) {
    processes.forEach((p, idx) => {
      const size = parseInt(p.size);
      memoryState.memory.push({
        id: `p_${idx}_${Date.now()}`,
        type: "process",
        name: p.name,
        startAddress: currentAddress,
        size: size,
        color: colors[idx % colors.length]
      });
      currentAddress += size;
      
      if (p.holeAfter) {
         memoryState.memory.push({
            id: `h_${idx}_${Date.now()}`,
            type: "hole",
            name: "Free",
            startAddress: currentAddress,
            size: p.holeAfter,
            color: "secondary"
         });
         currentAddress += p.holeAfter;
      }
    });
  }
  
  if (currentAddress < memoryState.totalMemory) {
    memoryState.memory.push({
      id: `h_end_${Date.now()}`,
      type: "hole",
      name: "Free",
      startAddress: currentAddress,
      size: memoryState.totalMemory - currentAddress,
      color: "secondary"
    });
  }
  
  const stats = getStats();
  res.json({
    memory: memoryState.memory,
    totalMemory: stats.total,
    usedMemory: stats.used,
    freeMemory: stats.free,
    fragmentedHoles: stats.holesCount
  });
});

// 2. POST /api/compact
app.post('/api/compact', (req, res) => {
  const before = JSON.parse(JSON.stringify(memoryState.memory));
  let processes = memoryState.memory.filter(b => b.type === "process");
  let holes = memoryState.memory.filter(b => b.type === "hole");
  
  let steps = [];
  let currentAddress = 0;
  
  let after = [];
  
  processes.forEach(p => {
    if (p.startAddress !== currentAddress) {
      steps.push(`Moving ${p.name} from address ${p.startAddress} to address ${currentAddress} (size: ${p.size} MB)`);
      p.startAddress = currentAddress;
    }
    after.push(p);
    currentAddress += p.size;
  });
  
  let maxPreviousHole = holes.length > 0 ? Math.max(...holes.map(h => h.size)) : 0;
  
  if (currentAddress < memoryState.totalMemory) {
    let finalHoleSize = memoryState.totalMemory - currentAddress;
    after.push({
      id: `h_merged_${Date.now()}`,
      type: "hole",
      name: "Free",
      startAddress: currentAddress,
      size: finalHoleSize,
      color: "secondary"
    });
    
    let savedSpace = finalHoleSize - maxPreviousHole;
    memoryState.memory = after;
    
    res.json({
      before,
      after,
      steps,
      savedSpace: savedSpace > 0 ? savedSpace : 0
    });
  } else {
    memoryState.memory = after;
    res.json({ before, after, steps, savedSpace: 0 });
  }
});

// 3. POST /api/add-process
app.post('/api/add-process', (req, res) => {
  const { name, size } = req.body;
  const processSize = parseInt(size);
  
  let allocated = false;
  let newMemory = [];
  
  const colors = ["primary", "success", "warning", "info", "danger", "dark"];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  for (let i = 0; i < memoryState.memory.length; i++) {
    const block = memoryState.memory[i];
    if (!allocated && block.type === "hole" && block.size >= processSize) {
      const newProcess = {
        id: `p_${Date.now()}`,
        type: "process",
        name: name,
        startAddress: block.startAddress,
        size: processSize,
        color: randomColor
      };
      newMemory.push(newProcess);
      
      if (block.size > processSize) {
        newMemory.push({
          id: `h_${Date.now()}`,
          type: "hole",
          name: "Free",
          startAddress: block.startAddress + processSize,
          size: block.size - processSize,
          color: "secondary"
        });
      }
      allocated = true;
    } else {
      newMemory.push(block);
    }
  }
  
  if (allocated) {
    memoryState.memory = newMemory;
    res.json({ success: true, memory: memoryState.memory, message: `Allocated ${name} successfully using First Fit.` });
  } else {
    res.json({ success: false, memory: memoryState.memory, message: `Failed to allocate ${name}. Not enough contiguous space.` });
  }
});

// 4. POST /api/remove-process
app.post('/api/remove-process', (req, res) => {
  const { name } = req.body;
  
  let found = false;
  memoryState.memory = memoryState.memory.map(b => {
    if (b.type === "process" && b.name === name) {
      found = true;
      return {
        ...b,
        type: "hole",
        name: "Free",
        color: "secondary"
      };
    }
    return b;
  });
  
  res.json({ memory: memoryState.memory, message: found ? `Removed ${name}` : `Process ${name} not found` });
});

// 5. GET /api/memory-state
app.get('/api/memory-state', (req, res) => {
  res.json({ memory: memoryState.memory, stats: getStats() });
});

// 6. POST /api/reset
app.post('/api/reset', (req, res) => {
  memoryState.memory = [{
    id: `h_initial_${Date.now()}`,
    type: "hole",
    name: "Free",
    startAddress: 0,
    size: memoryState.totalMemory,
    color: "secondary"
  }];
  res.json({ message: "Memory reset" });
});

// Random fragmentation
app.post('/api/random-fragmentation', (req, res) => {
   let processes = memoryState.memory.filter(p => p.type === "process");
   if(processes.length >= 2) {
      let indices = [];
      while(indices.length < 2) {
         let r = Math.floor(Math.random() * processes.length);
         if(indices.indexOf(r) === -1) indices.push(r);
      }
      
      let namesToRemove = indices.map(i => processes[i].name);
      memoryState.memory = memoryState.memory.map(b => {
         if(b.type === "process" && namesToRemove.includes(b.name)) {
            return {
               ...b,
               type: "hole",
               name: "Free",
               color: "secondary"
            };
         }
         return b;
      });
      res.json({message: `Randomly removed: ${namesToRemove.join(', ')}`});
   } else {
      res.json({message: "Not enough processes to fragment randomly."});
   }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
