document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = '/api';
    
    // UI Elements
    let totalMemInput = document.getElementById('totalMemoryInput');
    let btnInit = document.getElementById('btnInitMemory');
    
    let addProcessForm = document.getElementById('addProcessForm');
    let pName = document.getElementById('processName');
    let pSize = document.getElementById('processSize');
    
    let removeProcessForm = document.getElementById('removeProcessForm');
    let processSelect = document.getElementById('processSelect');
    
    let btnCompact = document.getElementById('btnCompact');
    let btnReset = document.getElementById('btnReset');
    let btnLoadDemo = document.getElementById('btnLoadDemo');
    let btnRandomFragment = document.getElementById('btnRandomFragment');
    
    let stepModeSwitch = document.getElementById('stepModeSwitch');
    let btnNextStep = document.getElementById('btnNextStep');
    
    let memoryContainer = document.getElementById('memoryContainer');
    let addressScale = document.getElementById('addressScale');
    
    // Stats UI
    let usedMemText = document.getElementById('usedMemoryText');
    let usedMemBar = document.getElementById('usedMemoryBar');
    let freeMemText = document.getElementById('freeMemoryText');
    let freeMemBar = document.getElementById('freeMemoryBar');
    let fragText = document.getElementById('fragPercentageText');
    let fragBar = document.getElementById('fragPercentageBar');
    let holesText = document.getElementById('holesCountText');
    let memoryInfoBadge = document.getElementById('memoryInfoBadge');
    
    let actionLog = document.getElementById('actionLog');
    
    // State
    let currentState = null;
    let stepMode = false;
    
    // Compaction State properties
    let compactionStepsData = [];
    let currentStepIndex = 0;
    
    // Helper to log actions
    function logAction(msg, type="info") {
        let colors = {
            "info": "#94a3b8", // muted for standard logs
            "success": "#4ade80", // vibrant green
            "error": "#f87171", // red
            "warning": "#fbbf24" // yellow
        };
        let p = document.createElement('div');
        p.style.color = colors[type];
        p.innerText = `> ${msg}`;
        p.style.marginBottom = "4px";
        actionLog.appendChild(p);
        actionLog.scrollTop = actionLog.scrollHeight;
    }

    // API calls
    async function fetchState() {
        try {
            let res = await fetch(`${API_BASE}/memory-state`);
            let data = await res.json();
            updateUI(data);
        } catch (e) {
            logAction("Error fetching memory state", "error");
        }
    }

    async function initializeMemory(total, processes=[]) {
        try {
            let res = await fetch(`${API_BASE}/initialize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalMemory: parseInt(total), processes })
            });
            let data = await res.json();
            logAction(`Memory initialized successfully. Cap: ${total} MB`, "success");
            fetchState();
        } catch (e) {
            logAction("Error initializing memory", "error");
        }
    }

    // Initialization
    fetchState();

    // Listeners
    btnInit.addEventListener('click', () => {
        initializeMemory(totalMemInput.value);
    });

    // Modal & Toast references
    const compactionModal = new bootstrap.Modal(document.getElementById('compactionModal'));
    const errorToast      = new bootstrap.Toast(document.getElementById('errorToast'), { delay: 4000 });
    const modalCompactBtn  = document.getElementById('modalCompactBtn');
    const errorToastMsg    = document.getElementById('errorToastMsg');

    // Holds pending process while user is shown the modal
    let pendingProcess = null;

    addProcessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = pName.value.trim();
        const size = parseInt(pSize.value);
        await tryAddProcess(name, size);
    });

    async function tryAddProcess(name, size, isRetry = false) {
        try {
            let res = await fetch(`${API_BASE}/add-process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, size })
            });
            let data = await res.json();

            if (data.success) {
                logAction(data.message, "success");
                pName.value = '';
                pSize.value = '';
                fetchState();
            } else {
                fetchState(); // keep display updated

                if (data.isDuplicate) {
                    // Duplicate process name — show error toast immediately
                    errorToastMsg.textContent = data.message;
                    logAction(data.message, "error");
                    errorToast.show();
                } else if (data.compactionWouldHelp) {
                    // Show the popup — compaction will free enough space
                    pendingProcess = { name, size };
                    document.getElementById('modalProcessName').textContent = `Process: ${name}  (${size} MB required)`;
                    document.getElementById('modalProcessInfo').textContent =
                        `Cannot allocate — no single hole is large enough.`;
                    document.getElementById('modalLargestHole').textContent = `${data.largestHole} MB`;
                    document.getElementById('modalTotalFree').textContent   = `${data.totalFree} MB`;
                    document.getElementById('modalNeedSize').textContent    = `${size} MB`;
                    document.getElementById('modalExplanation').textContent =
                        `Total free memory (${data.totalFree} MB) is enough for ${name} (${size} MB), but it is ` +
                        `scattered across multiple holes. Compacting memory will merge all gaps into one ` +
                        `contiguous free block so the process can be allocated.`;
                    logAction(`⚠ Compaction needed to fit ${name} (${size} MB). Total free: ${data.totalFree} MB, largest hole: ${data.largestHole} MB.`, "warning");
                    compactionModal.show();
                } else {
                    // Not even compaction can help — show error toast
                    if (isRetry) {
                        errorToastMsg.textContent = `Even after compaction, not enough memory for ${name} (${size} MB). Total free: ${data.totalFree} MB.`;
                    } else {
                        errorToastMsg.textContent = data.message;
                    }
                    logAction(data.message, "error");
                    errorToast.show();
                    pName.value = '';
                    pSize.value = '';
                }
            }
        } catch (error) {
            logAction("Error adding process", "error");
        }
    }

    // "Compact & Retry" button inside the modal
    modalCompactBtn.addEventListener('click', async () => {
        compactionModal.hide();
        if (!pendingProcess) return;

        logAction(`Auto-compacting memory to fit ${pendingProcess.name}...`, "info");

        try {
            // Run compaction first
            let cRes = await fetch(`${API_BASE}/compact`, { method: 'POST' });
            let cData = await cRes.json();

            if (cData.steps.length === 0) {
                logAction("Memory is already compacted.", "info");
            } else {
                cData.steps.forEach(s => logAction(s, "success"));
                logAction(`Compaction complete — ${cData.savedSpace} MB merged into one block.`, "success");
            }

            // Retry the process allocation
            const { name, size } = pendingProcess;
            pendingProcess = null;
            await tryAddProcess(name, size, true);

        } catch (err) {
            logAction("Error during auto-compaction", "error");
        }
    });

    removeProcessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!processSelect.value) return;
        try {
            let res = await fetch(`${API_BASE}/remove-process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: processSelect.value })
            });
            let data = await res.json();
            logAction(data.message, "warning");
            fetchState();
        } catch (error) {
           logAction("Error removing process", "error");
        }
    });

    btnReset.addEventListener('click', async () => {
        try {
            let res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
            let data = await res.json();
            logAction(data.message, "info");
            fetchState();
        } catch (error) {
            logAction("Error resetting memory", "error");
        }
    });

    btnLoadDemo.addEventListener('click', () => {
        const demoProcs = [
            { name: "P1", size: 100, holeAfter: 50 },
            { name: "P2", size: 200, holeAfter: 75 },
            { name: "P3", size: 150, holeAfter: 30 },
            { name: "P4", size: 80, holeAfter: 100 },
            { name: "P5", size: 120, holeAfter: 0 }
        ];
        totalMemInput.value = 1024;
        initializeMemory(1024, demoProcs);
        logAction("Loaded Demo Scenario", "success");
    });
    
    btnRandomFragment.addEventListener('click', async () => {
       try {
            let res = await fetch(`${API_BASE}/random-fragmentation`, { method: 'POST' });
            let data = await res.json();
            if (data.message.includes("Randomly removed")) {
                logAction(data.message, "warning");
                fetchState();
            } else {
                logAction(data.message, "info");
            }
       } catch (error) {
           logAction("Error fragmenting memory", "error");
       }
    });
    
    stepModeSwitch.addEventListener('change', (e) => {
        stepMode = e.target.checked;
        if(stepMode) {
            btnCompact.innerText = "Start Step Compaction";
            btnCompact.classList.replace("btn-success", "btn-warning");
        } else {
            btnCompact.innerText = "Compact Memory";
            btnCompact.classList.replace("btn-warning", "btn-success");
            btnNextStep.classList.add("d-none");
            
            // if step by step was ongoing, exit it
            if(compactionStepsData && compactionStepsData.steps && compactionStepsData.steps.length > 0) {
               fetchState();
               compactionStepsData = [];
               btnCompact.removeAttribute("disabled");
            }
        }
    });

    btnCompact.addEventListener('click', async () => {
        if(stepMode) {
            // Initiate step-by-step
            if(compactionStepsData && compactionStepsData.steps && compactionStepsData.steps.length > 0 && currentStepIndex < compactionStepsData.steps.length) return; // Prevent double trigger
            
            try {
                let res = await fetch(`${API_BASE}/compact`, { method: 'POST' });
                let data = await res.json();
                
                if(data.steps.length === 0) {
                    logAction("Memory is already compacted.", "info");
                    fetchState(); // resets holes if there are tiny math anomalies, ensuring single hole 
                    return;
                }
                
                compactionStepsData = data;
                currentStepIndex = 0;
                
                // Set the memory to BEFORE state to begin animation safely
                currentState.memory = data.before;
                renderMemory(currentState.memory, currentState.stats.total);
                
                btnCompact.setAttribute("disabled", "true");
                btnNextStep.classList.remove("d-none");
                
                logAction("Step-by-step compaction started. Press 'Next'", "info");
                highlightNextStepBlock(); // Highlight the first block that is about to move
                
            } catch (error) {
                 logAction("Error starting step compaction", "error");
            }
        } else {
            try {
                let res = await fetch(`${API_BASE}/compact`, { method: 'POST' });
                let data = await res.json();
                
                if(data.steps.length === 0) {
                     logAction("Memory is already compacted.", "info");
                } else {
                     data.steps.forEach(s => logAction(s, "success"));
                     logAction(`Compaction saved space: ${data.savedSpace} MB merged.`, "success");
                }
                
                fetchState();
            } catch (error) {
                 logAction("Error compacting memory", "error");
            }
        }
    });
    
    function highlightNextStepBlock() {
         if (!compactionStepsData.steps || currentStepIndex >= compactionStepsData.steps.length) {
            return;
         }
         let stepString = compactionStepsData.steps[currentStepIndex];
         let match = stepString.match(/Moving (.+?) from/);
         if(match) {
             let pName = match[1];
             let blocks = document.querySelectorAll('.memory-block');
             blocks.forEach(b => b.classList.remove('step-highlight'));
             
             let block = Array.from(blocks).find(b => b.querySelector('span') && b.querySelector('span').innerText.includes(pName));
             if(block) block.classList.add('step-highlight');
         }
    }
    
    btnNextStep.addEventListener('click', () => {
        if(currentStepIndex < compactionStepsData.steps.length) {
            let stepString = compactionStepsData.steps[currentStepIndex];
            logAction(`Step ${currentStepIndex+1}: ${stepString}`, "warning");
            
            let match = stepString.match(/Moving (.+?) from address (\d+) to address (\d+)/);
            if(match) {
               let pName = match[1];
               let oldAddr = parseInt(match[2]);
               let newAddr = parseInt(match[3]);
               
               // Logical update of DOM via state modification forces slide transition via top
               let p = currentState.memory.find(b => b.type === 'process' && b.name === pName);
               if(p) p.startAddress = newAddr;
               
               renderMemory(currentState.memory, currentState.stats.total);
            }
            
            currentStepIndex++;
            highlightNextStepBlock();
            
            if(currentStepIndex >= compactionStepsData.steps.length) {
                 btnNextStep.classList.add("d-none");
                 btnCompact.removeAttribute("disabled");
                 logAction("Compaction steps completed.", "success");
                 compactionStepsData = [];
                 fetchState(); 
            }
        }
    });

    function updateUI(data) {
        currentState = data;
        let stats = data.stats;
        let memNodes = data.memory;
        
        // Update Stats
        memoryInfoBadge.innerText = `${stats.used} / ${stats.total} MB`;
        usedMemText.innerText = `${stats.used} MB`;
        freeMemText.innerText = `${stats.free} MB`;
        usedMemBar.style.width = `${(stats.used/stats.total)*100}%`;
        freeMemBar.style.width = `${(stats.free/stats.total)*100}%`;
        
        let fp = parseFloat(stats.fragmentationPercentage);
        fragText.innerText = `${fp}%`;
        fragBar.style.width = `${fp}%`;
        
        if (fp > 30) {
            fragBar.classList.remove('bg-danger', 'bg-warning', 'bg-info');
            fragBar.classList.add('bg-danger');
        } else if (fp > 10) {
            fragBar.classList.remove('bg-danger', 'bg-warning', 'bg-info');
            fragBar.classList.add('bg-warning');
        } else {
            fragBar.classList.remove('bg-danger', 'bg-warning', 'bg-info');
            fragBar.classList.add('bg-info');
        }

        holesText.innerText = stats.holesCount;

        // Update Processes Dropdown
        processSelect.innerHTML = '<option value="" disabled selected>Select Process...</option>';
        memNodes.filter(b => b.type === 'process').forEach(p => {
             let opt = document.createElement('option');
             opt.value = p.name;
             opt.innerText = `${p.name} (${p.size}MB)`;
             processSelect.appendChild(opt);
        });

        renderMemory(memNodes, stats.total);
    }
    
    function renderMemory(blocks, totalMemory) {
       memoryContainer.innerHTML = '';
       addressScale.innerHTML = '';
       
       // Create scale marks - vertical scale text corresponding to Addresses
       let marks = 6;
       for(let i=0; i<=marks; i++) {
           let val = Math.round((totalMemory / marks) * i);
           let topPercent = (val / totalMemory) * 100;
           
           let mark = document.createElement('div');
           mark.className = 'address-mark';
           mark.style.top = `${topPercent}%`;
           mark.innerText = val;
           addressScale.appendChild(mark);
       }
       
       // Clear side labels panel
       const holeSideLabels = document.getElementById('holeSideLabels');
       if (holeSideLabels) holeSideLabels.innerHTML = '';

       blocks.forEach(b => {
           let topPercent = (b.startAddress / totalMemory) * 100;
           let heightPercent = (b.size / totalMemory) * 100;
           
           // safety bounds
           if(heightPercent <= 0) return;
           
           let div = document.createElement('div');
           div.className = `memory-block type-${b.type}`;
           if(b.type === 'process') div.classList.add(`bg-${b.color}`);
           
           div.style.top = `${topPercent}%`;
           div.style.height = `${heightPercent}%`;
           
           // Use Bootstrap tooltips mapping
           div.title = `${b.name}\nStart: ${b.startAddress}\nSize: ${b.size} MB`;
           div.setAttribute('data-bs-toggle', 'tooltip');
           div.setAttribute('data-bs-placement', 'left');
           
           if(b.type === 'process') {
               div.innerHTML = `<span><strong style="font-size: 1.1rem;">${b.name}</strong><br>${b.size}MB</span>`;
           } else {
               // Inside the bar: show label only if enough visual room
               if(heightPercent > 2.5) {
                   div.innerHTML = `<span style="color:#64748b; font-weight:600;">Free<br>${b.size} MB</span>`;
               } else if(heightPercent > 0.8) {
                   div.innerHTML = `<span style="color:#64748b; font-weight:600; font-size:0.65rem;">Free ${b.size} MB</span>`;
               }

               // External side label — always added for EVERY hole
               if(holeSideLabels) {
                   let midPercent = topPercent + heightPercent / 2;

                   let label = document.createElement('div');
                   label.style.cssText = `
                       position: absolute;
                       top: ${midPercent}%;
                       transform: translateY(-50%);
                       left: 0;
                       display: flex;
                       align-items: center;
                       gap: 3px;
                       white-space: nowrap;
                       pointer-events: none;
                       z-index: 20;
                   `;

                   // small connector line
                   let line = document.createElement('div');
                   line.style.cssText = `
                       width: 10px;
                       height: 1.5px;
                       background: #94a3b8;
                       flex-shrink: 0;
                   `;

                   // text badge
                   let badge = document.createElement('div');
                   badge.style.cssText = `
                       background: #e2e8f0;
                       border: 1px solid #cbd5e1;
                       border-radius: 4px;
                       padding: 1px 5px;
                       font-size: 0.68rem;
                       font-weight: 700;
                       color: #475569;
                       line-height: 1.5;
                   `;
                   badge.textContent = `Free ${b.size} MB`;

                   label.appendChild(line);
                   label.appendChild(badge);
                   holeSideLabels.appendChild(label);
               }
           }
           
           memoryContainer.appendChild(div);
       });
       
       // Re-init tooltips
       let tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
       tooltipTriggerList.map(function (tooltipTriggerEl) {
          return new bootstrap.Tooltip(tooltipTriggerEl);
       });
    }

});
