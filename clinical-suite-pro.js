/**
 * clinical-suite-pro.js - Isolated Advanced Clinical & Practice Operations Suite
 *
 * Modules (zero impact on existing business logic):
 * 1. Chairside Voice-to-Clinical-Notes (Web Speech API + Dental Keyword Parser)
 * 2. Per-Tooth Endo / RCT Working-Length & Obturation Tracker
 * 3. Visual Case Acceptance Builder (Good / Better / Best + EMI/Milestone Splitter)
 * 4. Dental X-Ray / RVG & Intraoral Image Annotator (HTML5 Canvas)
 * 5. Automated Sterilization & Autoclave Cycle Log (Compliance Ready)
 * 6. Dental Consumables Stock & Expiry Alert Manager
 * 7. Associate / Visiting Doctor Revenue Split Calculator (Read-Only Ledger Integration)
 */

(function(window) {
    'use strict';

    function getActivePatient() {
        return window.currentPatient || (typeof currentPatient !== 'undefined' ? currentPatient : null) || {};
    }

    function getClinicName() {
        return (window.currentClinicSettings && (window.currentClinicSettings.clinic_name || window.currentClinicSettings.name)) || 'Dental Clinic';
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // =========================================================================
    // 1. CHAIRSIDE VOICE-TO-CLINICAL-NOTES (AI DICTATION)
    // =========================================================================
    let speechRec = null;
    let isListening = false;

    function toggleVoiceDictation() {
        const btn = document.getElementById('voiceDictateBtn');
        const statusEl = document.getElementById('voiceDictateStatus');
        const previewEl = document.getElementById('voiceDictatePreview');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            if (statusEl) statusEl.innerText = 'Voice dictation requires Chrome, Edge, or Android WebView.';
            alert('Voice dictation is not supported in this browser. Please use Chrome, Edge, or the Android App.');
            return;
        }

        if (isListening && speechRec) {
            speechRec.stop();
            return;
        }

        speechRec = new SpeechRecognition();
        speechRec.lang = 'en-IN';
        speechRec.continuous = true;
        speechRec.interimResults = true;

        let finalTranscript = '';

        speechRec.onstart = () => {
            isListening = true;
            if (btn) {
                btn.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Dictating';
                btn.style.background = '#EF4444';
            }
            if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444; font-weight:800;">● Listening chairside... Speak findings & diagnosis</span>';
        };

        speechRec.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalTranscript += t + ' ';
                else interim += t;
            }
            const combined = (finalTranscript + interim).trim();
            if (previewEl) {
                previewEl.style.display = 'block';
                previewEl.value = combined;
            }
            parseAndPopulateDiagnosis(combined);
        };

        speechRec.onerror = (e) => {
            console.warn('[VoiceDictation] Error:', e.error);
            if (statusEl) statusEl.innerText = 'Mic notice: ' + e.error;
            stopVoiceUI();
        };

        speechRec.onend = () => {
            stopVoiceUI();
        };

        try {
            speechRec.start();
        } catch (err) {
            console.warn('[VoiceDictation] Start error:', err);
            stopVoiceUI();
        }
    }

    function stopVoiceUI() {
        isListening = false;
        const btn = document.getElementById('voiceDictateBtn');
        const statusEl = document.getElementById('voiceDictateStatus');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-microphone"></i> Dictate Clinical Note';
            btn.style.background = 'var(--primary, #0D9488)';
        }
        if (statusEl && statusEl.innerText.includes('Listening')) {
            statusEl.innerText = 'Dictation paused. Review fields below and tap Save Clinical Diagnosis.';
        }
    }

    function parseAndPopulateDiagnosis(rawText) {
        if (!rawText) return;
        const titleEl = document.getElementById('diagTitle');
        const notesEl = document.getElementById('diagNotes');

        // Smart keyword extraction for dental notes
        const diagMatch = rawText.match(/(?:diagnosis|condition|advised|plan)\s*(?:is|:)?\s*([^.,;]+)/i);
        const toothMatch = rawText.match(/(?:tooth|teeth|#)\s*(\d{2})/i);

        if (titleEl && (diagMatch || toothMatch)) {
            let extractedTitle = diagMatch ? diagMatch[1].trim() : '';
            if (toothMatch && !extractedTitle.includes(toothMatch[1])) {
                extractedTitle = (extractedTitle ? extractedTitle + ' — ' : '') + 'Tooth #' + toothMatch[1];
            }
            if (extractedTitle) titleEl.value = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
        } else if (titleEl && !titleEl.value.trim()) {
            titleEl.value = rawText.split(/[.,]/)[0].slice(0, 70);
        }

        if (notesEl) {
            notesEl.value = rawText;
        }
    }

    // =========================================================================
    // 2. PER-TOOTH ENDO / RCT WORKING-LENGTH & OBTURATION TRACKER
    // =========================================================================
    function addEndoCanalRow(canalName = '', refPt = 'Cusp Tip', wl = '', maf = '', obt = 'Gutta-Percha') {
        const container = document.getElementById('endoCanalsContainer');
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'endo-canal-row';
        row.style.cssText = 'display:grid; grid-template-columns: 1fr 1.1fr 0.9fr 0.9fr 1.2fr auto; gap:0.4rem; align-items:center; margin-bottom:0.45rem;';
        row.innerHTML = `
            <input type="text" class="form-control endo-c-name" placeholder="MB / DB / P" value="${escapeHtml(canalName)}" style="height:34px; font-size:0.8rem; padding:0 0.5rem; border:1px solid #CBD5E1; border-radius:6px;">
            <input type="text" class="form-control endo-c-ref" placeholder="Ref Point" value="${escapeHtml(refPt)}" style="height:34px; font-size:0.8rem; padding:0 0.5rem; border:1px solid #CBD5E1; border-radius:6px;">
            <input type="text" class="form-control endo-c-wl" placeholder="e.g. 20.5mm" value="${escapeHtml(wl)}" style="height:34px; font-size:0.8rem; padding:0 0.5rem; border:1px solid #CBD5E1; border-radius:6px;">
            <input type="text" class="form-control endo-c-maf" placeholder="e.g. 25/.06" value="${escapeHtml(maf)}" style="height:34px; font-size:0.8rem; padding:0 0.5rem; border:1px solid #CBD5E1; border-radius:6px;">
            <input type="text" class="form-control endo-c-obt" placeholder="Obturation" value="${escapeHtml(obt)}" style="height:34px; font-size:0.8rem; padding:0 0.5rem; border:1px solid #CBD5E1; border-radius:6px;">
            <button type="button" onclick="this.parentElement.remove()" style="background:#FEE2E2; color:#DC2626; border:none; width:30px; height:34px; border-radius:6px; cursor:pointer; font-weight:800;">&times;</button>
        `;
        container.appendChild(row);
    }

    function presetEndoCanals(type) {
        const container = document.getElementById('endoCanalsContainer');
        if (!container) return;
        container.innerHTML = '';
        if (type === 'anterior') {
            addEndoCanalRow('Single Canal', 'Incisal Edge', '', '30/.04', 'Gutta-Percha');
        } else if (type === 'premolar') {
            addEndoCanalRow('Buccal (B)', 'Buccal Cusp', '', '25/.04', 'Gutta-Percha');
            addEndoCanalRow('Palatal/Lingual', 'Lingual Cusp', '', '25/.04', 'Gutta-Percha');
        } else if (type === 'upper_molar') {
            addEndoCanalRow('MB1', 'MB Cusp', '', '25/.04', 'Gutta-Percha');
            addEndoCanalRow('MB2', 'MB Cusp', '', '20/.04', 'Gutta-Percha');
            addEndoCanalRow('DB', 'DB Cusp', '', '25/.04', 'Gutta-Percha');
            addEndoCanalRow('Palatal (P)', 'Palatal Cusp', '', '30/.06', 'Gutta-Percha');
        } else {
            addEndoCanalRow('MB', 'MB Cusp', '', '25/.04', 'Gutta-Percha');
            addEndoCanalRow('ML', 'ML Cusp', '', '25/.04', 'Gutta-Percha');
            addEndoCanalRow('Distal (D)', 'Distal Cusp', '', '30/.06', 'Gutta-Percha');
        }
    }

    async function saveEndoRecord() {
        const pat = getActivePatient();
        if (!pat || !pat.mobile) {
            alert('Please open a patient profile first.');
            return;
        }
        const tooth = document.getElementById('endoToothInput')?.value?.trim();
        if (!tooth) {
            alert('Please enter Tooth Number (e.g. 46).');
            return;
        }
        const diagnosis = document.getElementById('endoDiagnosisSelect')?.value || 'Symptomatic Irreversible Pulpitis';
        const stage = document.getElementById('endoStageSelect')?.value || 'Working Length / BMP';
        const irrigant = document.getElementById('endoIrrigantInput')?.value?.trim() || 'NaOCl 3% + EDTA 17% + Saline';
        const notes = document.getElementById('endoNotesInput')?.value?.trim() || '';

        const canals = Array.from(document.querySelectorAll('#endoCanalsContainer .endo-canal-row')).map(row => ({
            canal: row.querySelector('.endo-c-name')?.value?.trim() || '',
            refPoint: row.querySelector('.endo-c-ref')?.value?.trim() || '',
            workingLength: row.querySelector('.endo-c-wl')?.value?.trim() || '',
            maf: row.querySelector('.endo-c-maf')?.value?.trim() || '',
            obturation: row.querySelector('.endo-c-obt')?.value?.trim() || ''
        })).filter(c => c.canal || c.workingLength);

        const record = {
            patientMobile: pat.mobile,
            patientName: pat.name || 'Patient',
            tooth: tooth,
            diagnosis: diagnosis,
            stage: stage,
            irrigant: irrigant,
            canals: canals,
            notes: notes,
            date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        };

        if (window.dbAPI && typeof window.dbAPI.saveEndoRecord === 'function') {
            await window.dbAPI.saveEndoRecord(record);
        }
        if (document.getElementById('endoNotesInput')) document.getElementById('endoNotesInput').value = '';
        await loadEndoRecords(pat.mobile);
    }

    async function loadEndoRecords(mobile) {
        const container = document.getElementById('endoRecordsList');
        const canalBox = document.getElementById('endoCanalsContainer');
        if (canalBox && canalBox.children.length === 0) {
            presetEndoCanals('lower_molar');
        }
        if (!container || !mobile || !window.dbAPI || typeof window.dbAPI.getEndoRecords !== 'function') return;

        const list = await window.dbAPI.getEndoRecords(mobile);
        if (!list || list.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:#94A3B8; font-size:0.85rem;">No Root Canal / Endo canal sheets recorded yet for this patient.</div>';
            return;
        }

        container.innerHTML = list.map(rec => `
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:0.9rem; margin-bottom:0.75rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
                    <div>
                        <span style="background:var(--primary, #0D9488); color:white; padding:2px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">Tooth #${escapeHtml(rec.tooth)}</span>
                        <strong style="margin-left:6px; color:#0F172A; font-size:0.88rem;">${escapeHtml(rec.diagnosis)}</strong>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span style="background:#EEF2FF; color:#4338CA; padding:2px 8px; border-radius:99px; font-size:0.74rem; font-weight:800;">${escapeHtml(rec.stage)}</span>
                        <span style="font-size:0.74rem; color:#64748B;">${escapeHtml(rec.date || '')}</span>
                    </div>
                </div>
                <div style="font-size:0.76rem; color:#475569; margin-bottom:0.5rem;"><strong>Irrigants:</strong> ${escapeHtml(rec.irrigant)}</div>
                ${(rec.canals && rec.canals.length > 0) ? `
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.76rem; background:white; border-radius:6px; overflow:hidden;">
                        <thead>
                            <tr style="background:#F1F5F9; color:#475569; text-align:left;">
                                <th style="padding:5px 8px;">Canal</th>
                                <th style="padding:5px 8px;">Ref Point</th>
                                <th style="padding:5px 8px;">Working Length</th>
                                <th style="padding:5px 8px;">MAF / Taper</th>
                                <th style="padding:5px 8px;">Obturation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rec.canals.map(c => `
                            <tr style="border-top:1px solid #F1F5F9;">
                                <td style="padding:5px 8px; font-weight:700;">${escapeHtml(c.canal)}</td>
                                <td style="padding:5px 8px;">${escapeHtml(c.refPoint)}</td>
                                <td style="padding:5px 8px; font-weight:800; color:#0284C7;">${escapeHtml(c.workingLength)}</td>
                                <td style="padding:5px 8px;">${escapeHtml(c.maf)}</td>
                                <td style="padding:5px 8px;">${escapeHtml(c.obturation)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
                ${rec.notes ? `<div style="margin-top:0.45rem; font-size:0.76rem; color:#334155;"><em>Note: ${escapeHtml(rec.notes)}</em></div>` : ''}
            </div>
        `).join('');
    }

    // =========================================================================
    // 3. GOOD / BETTER / BEST + MILESTONE SPLITTER (TREATMENT PLANS)
    // =========================================================================
    function updateMilestoneSplitPreview() {
        const total = parseFloat(document.getElementById('cbBetterPrice')?.value) || parseFloat(document.getElementById('cbBestPrice')?.value) || 0;
        const count = parseInt(document.getElementById('cbMilestoneCount')?.value) || 3;
        const box = document.getElementById('cbMilestonePreview');
        if (!box) return;

        if (total <= 0) {
            box.innerHTML = '<span style="color:#64748B;">Enter option prices above to preview milestone installments.</span>';
            return;
        }

        const weights = count === 2 ? [0.5, 0.5] : (count === 3 ? [0.4, 0.4, 0.2] : [0.3, 0.3, 0.2, 0.2]);
        const labels = count === 2
            ? ['Stage 1 (Start)', 'Stage 2 (Completion)']
            : (count === 3 ? ['Stage 1 (Initiation)', 'Stage 2 (Mid-Treatment / Trial)', 'Stage 3 (Final Delivery)'] : ['Booking / Scan', 'Stage 1', 'Trial', 'Final Cementation']);

        box.innerHTML = weights.map((w, idx) => {
            const amt = Math.round(total * w);
            return `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed #E2E8F0; font-size:0.78rem;">
                <span><strong>${labels[idx]}</strong> (${Math.round(w * 100)}%)</span>
                <strong style="color:var(--primary, #0D9488);">₹${amt.toLocaleString('en-IN')}</strong>
            </div>`;
        }).join('');
    }

    async function saveAndShareCaseOptions(sendWhatsApp = false) {
        const pat = getActivePatient();
        const title = document.getElementById('cbCaseTitle')?.value?.trim() || 'Crown & Restorative Options';
        const goodName = document.getElementById('cbGoodName')?.value?.trim() || 'Standard (PFM)';
        const goodPrice = parseFloat(document.getElementById('cbGoodPrice')?.value) || 0;
        const betterName = document.getElementById('cbBetterName')?.value?.trim() || 'Recommended (Monolithic Zirconia)';
        const betterPrice = parseFloat(document.getElementById('cbBetterPrice')?.value) || 0;
        const bestName = document.getElementById('cbBestName')?.value?.trim() || 'Premium (Layered E-Max / Imported Zirconia)';
        const bestPrice = parseFloat(document.getElementById('cbBestPrice')?.value) || 0;
        const milestones = parseInt(document.getElementById('cbMilestoneCount')?.value) || 3;

        if (pat && pat.mobile && window.dbAPI && typeof window.dbAPI.saveTreatmentOptionQuote === 'function') {
            await window.dbAPI.saveTreatmentOptionQuote({
                patientMobile: pat.mobile,
                patientName: pat.name || 'Patient',
                title, goodName, goodPrice, betterName, betterPrice, bestName, bestPrice, milestones
            });
        }

        const msg = `*${getClinicName()} — Treatment Options for ${pat.name || 'You'}*\n` +
            `*Case:* ${title}\n\n` +
            `1️⃣ *Good:* ${goodName} — ₹${goodPrice.toLocaleString('en-IN')}\n` +
            `2️⃣ *Better (Recommended):* ${betterName} — ₹${betterPrice.toLocaleString('en-IN')}\n` +
            `3️⃣ *Best (Premium):* ${bestName} — ₹${bestPrice.toLocaleString('en-IN')}\n\n` +
            `💳 *Flexible ${milestones}-Stage Milestone Payment Available*\n` +
            `Reply with your preferred option to confirm your sitting!`;

        if (sendWhatsApp && pat.mobile) {
            const digits = pat.mobile.replace(/[^0-9]/g, '');
            const waNum = digits.length === 10 ? '91' + digits : digits;
            window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
            alert('Treatment Options & Milestone Plan saved to patient record!');
        }
    }

    // =========================================================================
    // 4. DENTAL X-RAY / RVG & INTRAORAL IMAGE ANNOTATOR
    // =========================================================================
    let xrayCtx = null;
    let xrayBgImg = null;
    let xrayTool = 'circle';
    let xrayColor = '#EF4444';
    let xrayDrawing = false;
    let xrayStartX = 0, xrayStartY = 0;
    let xrayHistory = [];

    function initXrayCanvas() {
        const canvas = document.getElementById('xrayAnnotatorCanvas');
        if (!canvas || canvas.dataset.initialized === 'true') return;
        canvas.dataset.initialized = 'true';
        xrayCtx = canvas.getContext('2d');

        // Default placeholder grid
        xrayCtx.fillStyle = '#0F172A';
        xrayCtx.fillRect(0, 0, canvas.width, canvas.height);
        xrayCtx.fillStyle = '#94A3B8';
        xrayCtx.font = 'bold 15px sans-serif';
        xrayCtx.textAlign = 'center';
        xrayCtx.fillText('Upload an RVG, OPG, or Intraoral Photo above to annotate chairside', canvas.width / 2, canvas.height / 2);

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        };

        let snapshotBeforeShape = null;

        const onDown = (e) => {
            e.preventDefault();
            const pos = getPos(e);
            if (xrayTool === 'text') {
                const txt = prompt('Enter clinical callout label (e.g. Caries, Bone Loss, RCT):');
                if (txt) {
                    xrayHistory.push(xrayCtx.getImageData(0, 0, canvas.width, canvas.height));
                    xrayCtx.fillStyle = xrayColor;
                    xrayCtx.font = 'bold 18px sans-serif';
                    xrayCtx.textAlign = 'left';
                    xrayCtx.fillText(txt, pos.x, pos.y);
                }
                return;
            }
            xrayDrawing = true;
            xrayStartX = pos.x;
            xrayStartY = pos.y;
            xrayHistory.push(xrayCtx.getImageData(0, 0, canvas.width, canvas.height));
            if (xrayHistory.length > 15) xrayHistory.shift();
            snapshotBeforeShape = xrayCtx.getImageData(0, 0, canvas.width, canvas.height);

            if (xrayTool === 'pen') {
                xrayCtx.beginPath();
                xrayCtx.moveTo(pos.x, pos.y);
            }
        };

        const onMove = (e) => {
            if (!xrayDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            xrayCtx.strokeStyle = xrayColor;
            xrayCtx.lineWidth = 3.5;
            xrayCtx.lineCap = 'round';

            if (xrayTool === 'pen') {
                xrayCtx.lineTo(pos.x, pos.y);
                xrayCtx.stroke();
            } else if (xrayTool === 'circle' && snapshotBeforeShape) {
                xrayCtx.putImageData(snapshotBeforeShape, 0, 0);
                const r = Math.hypot(pos.x - xrayStartX, pos.y - xrayStartY);
                xrayCtx.beginPath();
                xrayCtx.arc(xrayStartX, xrayStartY, r, 0, Math.PI * 2);
                xrayCtx.stroke();
            } else if (xrayTool === 'arrow' && snapshotBeforeShape) {
                xrayCtx.putImageData(snapshotBeforeShape, 0, 0);
                drawArrow(xrayCtx, xrayStartX, xrayStartY, pos.x, pos.y, xrayColor);
            }
        };

        const onUp = () => {
            xrayDrawing = false;
            snapshotBeforeShape = null;
        };

        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
    }

    function drawArrow(ctx, fromx, fromy, tox, toy, color) {
        const headlen = 14;
        const angle = Math.atan2(toy - fromy, tox - fromx);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(fromx, fromy);
        ctx.lineTo(tox, toy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tox, toy);
        ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    }

    function setXrayTool(tool, color) {
        if (tool) xrayTool = tool;
        if (color) xrayColor = color;
        document.querySelectorAll('.xray-tool-btn').forEach(b => {
            b.style.outline = b.dataset.tool === xrayTool ? '2px solid #0F172A' : 'none';
        });
    }

    function loadXrayFile(input) {
        initXrayCanvas();
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                xrayBgImg = img;
                const canvas = document.getElementById('xrayAnnotatorCanvas');
                if (!canvas || !xrayCtx) return;
                xrayCtx.fillStyle = '#0F172A';
                xrayCtx.fillRect(0, 0, canvas.width, canvas.height);
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                xrayCtx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                xrayHistory = [];
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    function undoXrayAnnotation() {
        const canvas = document.getElementById('xrayAnnotatorCanvas');
        if (!canvas || !xrayCtx || xrayHistory.length === 0) return;
        const prev = xrayHistory.pop();
        xrayCtx.putImageData(prev, 0, 0);
    }

    function clearXrayCanvas() {
        const canvas = document.getElementById('xrayAnnotatorCanvas');
        if (!canvas || !xrayCtx) return;
        xrayHistory.push(xrayCtx.getImageData(0, 0, canvas.width, canvas.height));
        if (xrayBgImg) {
            xrayCtx.fillStyle = '#0F172A';
            xrayCtx.fillRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(canvas.width / xrayBgImg.width, canvas.height / xrayBgImg.height);
            const w = xrayBgImg.width * scale;
            const h = xrayBgImg.height * scale;
            xrayCtx.drawImage(xrayBgImg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        } else {
            xrayCtx.fillStyle = '#0F172A';
            xrayCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    async function saveXrayAnnotationRecord() {
        const pat = getActivePatient();
        const canvas = document.getElementById('xrayAnnotatorCanvas');
        if (!pat || !pat.mobile || !canvas) {
            alert('Please open a patient profile first.');
            return;
        }
        const caption = document.getElementById('xrayCaptionInput')?.value?.trim() || 'Annotated RVG / Radiograph';
        const tooth = document.getElementById('xrayToothInput')?.value?.trim() || 'General';
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);

        if (window.dbAPI && typeof window.dbAPI.saveXrayAnnotation === 'function') {
            await window.dbAPI.saveXrayAnnotation({
                patientMobile: pat.mobile,
                patientName: pat.name || 'Patient',
                tooth: tooth,
                caption: caption,
                imageData: dataUrl,
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            });
        }
        if (document.getElementById('xrayCaptionInput')) document.getElementById('xrayCaptionInput').value = '';
        await loadXrayAnnotations(pat.mobile);
    }

    async function loadXrayAnnotations(mobile) {
        initXrayCanvas();
        const gallery = document.getElementById('xraySavedGallery');
        if (!gallery || !mobile || !window.dbAPI || typeof window.dbAPI.getXrayAnnotations !== 'function') return;

        const list = await window.dbAPI.getXrayAnnotations(mobile);
        if (!list || list.length === 0) {
            gallery.innerHTML = '<div style="text-align:center; padding:1.25rem; color:#94A3B8; font-size:0.84rem;">No annotated X-Rays or RVG images saved yet.</div>';
            return;
        }

        gallery.innerHTML = list.map(item => `
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:0.75rem;">
                <img src="${item.imageData}" alt="Annotated X-Ray" style="width:100%; border-radius:8px; max-height:200px; object-fit:contain; background:#0F172A;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                    <div>
                        <span style="background:#EEF2FF; color:#4338CA; padding:2px 6px; border-radius:4px; font-size:0.72rem; font-weight:800;">Tooth: ${escapeHtml(item.tooth)}</span>
                        <div style="font-size:0.8rem; font-weight:700; color:#0F172A; margin-top:3px;">${escapeHtml(item.caption)}</div>
                        <div style="font-size:0.7rem; color:#64748B;">${escapeHtml(item.date || '')}</div>
                    </div>
                    <a href="${item.imageData}" download="xray_${escapeHtml(item.tooth)}.jpg" class="btn-primary" style="padding:0.3rem 0.65rem; font-size:0.74rem; text-decoration:none; border-radius:6px;">Save</a>
                </div>
            </div>
        `).join('');
    }

    // =========================================================================
    // 5. CLINIC OPS HUB: STERILIZATION, INVENTORY & DOCTOR PAYOUTS
    // =========================================================================
    function switchClinicOpsTab(subTab) {
        ['sterilization', 'inventory', 'payouts'].forEach(t => {
            const panel = document.getElementById('clinicOps_' + t);
            const btn = document.getElementById('clinicOpsBtn_' + t);
            if (panel) panel.style.display = t === subTab ? 'block' : 'none';
            if (btn) {
                btn.style.background = t === subTab ? 'var(--primary, #0D9488)' : '#FFFFFF';
                btn.style.color = t === subTab ? '#FFFFFF' : '#475569';
                btn.style.borderColor = t === subTab ? 'var(--primary, #0D9488)' : '#CBD5E1';
            }
        });
        if (subTab === 'sterilization') loadSterilizationLogs();
        if (subTab === 'inventory') loadInventoryItems();
        if (subTab === 'payouts') loadDoctorPayouts();
    }

    // --- 5A. Sterilization & Autoclave Cycle Log ---
    async function saveSterilizationCycle() {
        const batch = document.getElementById('sterilBatchInput')?.value?.trim() || ('AUT-' + String(Date.now()).slice(-4));
        const temp = document.getElementById('sterilTempInput')?.value?.trim() || '134°C / 30 PSI';
        const indicator = document.getElementById('sterilIndicatorSelect')?.value || 'Pass';
        const pouches = parseInt(document.getElementById('sterilPouchesInput')?.value) || 12;
        const staff = document.getElementById('sterilStaffInput')?.value?.trim() || 'Dental Assistant';

        const now = new Date();
        const log = {
            batch,
            temp,
            indicator,
            pouches,
            staff,
            timestampStr: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'
        };

        if (window.dbAPI && typeof window.dbAPI.saveSterilizationLog === 'function') {
            await window.dbAPI.saveSterilizationLog(log);
        }
        await loadSterilizationLogs();
    }

    async function loadSterilizationLogs() {
        const tbody = document.getElementById('sterilizationTableBody');
        if (!tbody || !window.dbAPI || typeof window.dbAPI.getSterilizationLogs !== 'function') return;
        const list = await window.dbAPI.getSterilizationLogs();
        if (!list || list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:1.5rem; text-align:center; color:#94A3B8;">No autoclave cycles logged yet today.</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(l => {
            const isPass = (l.indicator || 'Pass').toLowerCase() === 'pass';
            return `<tr style="border-bottom:1px solid #F1F5F9;">
                <td style="padding:8px 10px; font-weight:800; font-family:monospace;">${escapeHtml(l.batch)}</td>
                <td style="padding:8px 10px; font-size:0.78rem; color:#475569;">${escapeHtml(l.timestampStr)}</td>
                <td style="padding:8px 10px;">${escapeHtml(l.temp)}</td>
                <td style="padding:8px 10px;"><span style="background:${isPass ? '#DCFCE7' : '#FEE2E2'}; color:${isPass ? '#15803D' : '#DC2626'}; padding:2px 8px; border-radius:99px; font-weight:800; font-size:0.72rem;">${escapeHtml(l.indicator)}</span></td>
                <td style="padding:8px 10px; font-weight:700;">${escapeHtml(l.pouches)} packs</td>
                <td style="padding:8px 10px;">${escapeHtml(l.staff)}</td>
            </tr>`;
        }).join('');
    }

    // --- 5B. Consumables Stock & Expiry Alerts ---
    async function saveConsumableItem() {
        const name = document.getElementById('invNameInput')?.value?.trim();
        if (!name) { alert('Please enter item name.'); return; }
        const category = document.getElementById('invCategorySelect')?.value || 'Restorative';
        const qty = parseInt(document.getElementById('invQtyInput')?.value) || 0;
        const minQty = parseInt(document.getElementById('invMinInput')?.value) || 5;
        const expiry = document.getElementById('invExpiryInput')?.value || '';

        if (window.dbAPI && typeof window.dbAPI.saveInventoryItem === 'function') {
            await window.dbAPI.saveInventoryItem({ name, category, qty, minQty, expiry });
        }
        if (document.getElementById('invNameInput')) document.getElementById('invNameInput').value = '';
        await loadInventoryItems();
    }

    async function adjustInventoryQty(id, delta) {
        if (!window.dbAPI) return;
        const list = await window.dbAPI.getInventoryItems();
        const item = list.find(x => x.id === id);
        if (!item) return;
        item.qty = Math.max(0, (parseInt(item.qty) || 0) + delta);
        await window.dbAPI.saveInventoryItem(item);
        await loadInventoryItems();
    }

    async function loadInventoryItems() {
        const tbody = document.getElementById('inventoryTableBody');
        const alertBanner = document.getElementById('inventoryAlertSummary');
        if (!tbody || !window.dbAPI || typeof window.dbAPI.getInventoryItems !== 'function') return;

        const list = await window.dbAPI.getInventoryItems();
        if (!list || list.length === 0) {
            if (alertBanner) alertBanner.innerText = 'No consumables added yet.';
            tbody.innerHTML = '<tr><td colspan="6" style="padding:1.5rem; text-align:center; color:#94A3B8;">Add dental gloves, anesthetics, composites, or endo files above.</td></tr>';
            return;
        }

        let lowCount = 0;
        let expCount = 0;
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        tbody.innerHTML = list.map(item => {
            const isLow = (parseInt(item.qty) || 0) <= (parseInt(item.minQty) || 5);
            if (isLow) lowCount++;
            let expBadge = '<span style="color:#64748B;">-</span>';
            if (item.expiry) {
                const expMs = new Date(item.expiry).getTime();
                const isExpiring = (expMs - now) <= thirtyDaysMs;
                if (isExpiring) expCount++;
                expBadge = `<span style="background:${isExpiring ? '#FEE2E2' : '#F1F5F9'}; color:${isExpiring ? '#DC2626' : '#334155'}; padding:2px 7px; border-radius:5px; font-weight:700; font-size:0.74rem;">${escapeHtml(item.expiry)}${isExpiring ? ' ⚠️' : ''}</span>`;
            }

            return `<tr style="border-bottom:1px solid #F1F5F9;">
                <td style="padding:8px 10px; font-weight:800;">${escapeHtml(item.name)}</td>
                <td style="padding:8px 10px; font-size:0.78rem;">${escapeHtml(item.category)}</td>
                <td style="padding:8px 10px;">
                    <button type="button" onclick="ClinicalSuitePro.adjustInventoryQty('${item.id}', -1)" style="width:24px; height:24px; border-radius:4px; border:1px solid #CBD5E1; background:white; cursor:pointer;">-</button>
                    <strong style="margin:0 8px;">${item.qty}</strong>
                    <button type="button" onclick="ClinicalSuitePro.adjustInventoryQty('${item.id}', 1)" style="width:24px; height:24px; border-radius:4px; border:1px solid #CBD5E1; background:white; cursor:pointer;">+</button>
                </td>
                <td style="padding:8px 10px;">${expBadge}</td>
                <td style="padding:8px 10px;">
                    <span style="background:${isLow ? '#FEF3C7' : '#DCFCE7'}; color:${isLow ? '#B45309' : '#15803D'}; padding:2px 8px; border-radius:99px; font-weight:800; font-size:0.72rem;">
                        ${isLow ? '⚠️ Low Stock' : '✅ Healthy'}
                    </span>
                </td>
            </tr>`;
        }).join('');

        if (alertBanner) {
            alertBanner.innerHTML = `<strong>${list.length}</strong> Items Tracked • <span style="color:#B45309; font-weight:800;">${lowCount} Low Stock</span> • <span style="color:#DC2626; font-weight:800;">${expCount} Expiring &lt;30d</span>`;
        }
    }

    // --- 5C. Doctor & Associate Revenue Split Calculator (Read-Only Ledger) ---
    async function saveDoctorRule() {
        const docName = document.getElementById('payoutDocNameInput')?.value?.trim();
        if (!docName) { alert('Enter doctor name.'); return; }
        const pct = parseFloat(document.getElementById('payoutPercentInput')?.value) || 40;
        const labDeduction = parseFloat(document.getElementById('payoutLabDeductionInput')?.value) || 0;

        if (window.dbAPI && typeof window.dbAPI.saveDoctorPayoutRule === 'function') {
            await window.dbAPI.saveDoctorPayoutRule({ docName, pct, labDeduction });
        }
        if (document.getElementById('payoutDocNameInput')) document.getElementById('payoutDocNameInput').value = '';
        await loadDoctorPayouts();
    }

    async function loadDoctorPayouts() {
        const tbody = document.getElementById('doctorPayoutsTableBody');
        const grossEl = document.getElementById('payoutGrossCollectionVal');
        if (!tbody || !window.dbAPI) return;

        // Read-only computation of clinic total collected revenue from existing patients
        let totalCollected = 0;
        try {
            const patients = (typeof allPatients !== 'undefined' && Array.isArray(allPatients)) ? allPatients : (await window.dbAPI.getPatients() || []);
            patients.forEach(p => {
                totalCollected += parseFloat(p.paid || 0);
            });
        } catch(e) {}
        if (grossEl) grossEl.innerText = '₹' + Math.round(totalCollected).toLocaleString('en-IN');

        const rules = typeof window.dbAPI.getDoctorPayoutRules === 'function' ? await window.dbAPI.getDoctorPayoutRules() : [];
        if (!rules || rules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:1.5rem; text-align:center; color:#94A3B8;">Add an associate or visiting specialist above to calculate revenue share.</td></tr>';
            return;
        }

        tbody.innerHTML = rules.map(r => {
            const netBase = Math.max(0, totalCollected - (parseFloat(r.labDeduction) || 0));
            const shareAmt = Math.round(netBase * ((parseFloat(r.pct) || 0) / 100));
            return `<tr style="border-bottom:1px solid #F1F5F9;">
                <td style="padding:8px 10px; font-weight:800;">${escapeHtml(r.docName)}</td>
                <td style="padding:8px 10px;">₹${Math.round(totalCollected).toLocaleString('en-IN')}</td>
                <td style="padding:8px 10px; color:#64748B;">-₹${Math.round(r.labDeduction || 0).toLocaleString('en-IN')}</td>
                <td style="padding:8px 10px; font-weight:800; color:#0284C7;">${r.pct}%</td>
                <td style="padding:8px 10px; font-weight:900; color:#15803D;">₹${shareAmt.toLocaleString('en-IN')}</td>
            </tr>`;
        }).join('');
    }

    // Expose public API
    window.ClinicalSuitePro = {
        toggleVoiceDictation,
        addEndoCanalRow,
        presetEndoCanals,
        saveEndoRecord,
        loadEndoRecords,
        updateMilestoneSplitPreview,
        saveAndShareCaseOptions,
        initXrayCanvas,
        setXrayTool,
        loadXrayFile,
        undoXrayAnnotation,
        clearXrayCanvas,
        saveXrayAnnotationRecord,
        loadXrayAnnotations,
        switchClinicOpsTab,
        saveSterilizationCycle,
        loadSterilizationLogs,
        saveConsumableItem,
        adjustInventoryQty,
        loadInventoryItems,
        saveDoctorRule,
        loadDoctorPayouts
    };
})(window);
