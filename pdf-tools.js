document.addEventListener('DOMContentLoaded', () => {
    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

    let currentTool = 'merge'; // Default tool
    let uploadedFiles = []; // Array of File objects
    
    // UI Elements
    const tools = document.querySelectorAll('.menu-group li');
    const toolTitle = document.getElementById('tool-title');
    const toolDesc = document.getElementById('tool-desc');
    
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    
    const btnExecute = document.getElementById('btn-execute');
    const btnReset = document.getElementById('btn-reset');
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('spinner');
    const resultArea = document.getElementById('result-area');
    const downloadLinks = document.getElementById('download-links');
    
    // Config Panels
    const configPanels = document.querySelectorAll('.config-panel');
    const toolConfigDiv = document.getElementById('tool-config');

    // Tool Configurations
    const toolData = {
        'merge': {
            title: 'Gộp nhiều PDF thành một',
            desc: 'Kéo thả các tệp PDF vào khung bên dưới để tự động trộn thành 1 file duy nhất. Bạn có thể kéo thả nhiều file cùng lúc.',
            multiple: true,
            panel: null
        },
        'split': {
            title: 'Tách Trang PDF',
            desc: 'Trích xuất các trang cụ thể thành file PDF mới hoặc chia mỗi trang thành 1 file (mặc định). Chỉ chọn 1 file PDF.',
            multiple: false,
            panel: 'config-split'
        },
        'watermark': {
            title: 'Đóng Dấu Bản Quyền (Watermark)',
            desc: 'Chèn chữ nổi (Watermark) vào giữa tất cả các trang. Chỉ chọn 1 file PDF.',
            multiple: false,
            panel: 'config-watermark'
        },
        'edit': {
            title: 'Chỉnh Sửa (Xoá / Thêm Trang)',
            desc: 'Xoá các trang không cần thiết hoặc thêm trang trắng. Chỉ chọn 1 file PDF.',
            multiple: false,
            panel: null
        }
    };

    // --- 1. TOOL SWITCHING LOGIC ---
    tools.forEach(tool => {
        tool.addEventListener('click', () => {
            // Update Active State
            tools.forEach(t => t.classList.remove('active'));
            tool.classList.add('active');
            
            currentTool = tool.getAttribute('data-tool');
            const data = toolData[currentTool];
            
            // Update Headers
            toolTitle.innerText = data.title;
            toolDesc.innerText = data.desc;
            
            // Update Input Accept/Multiple
            fileInput.multiple = data.multiple;
            
            // Show/Hide Config Panels
            configPanels.forEach(p => p.style.display = 'none');
            if (data.panel) {
                toolConfigDiv.style.display = 'block';
                document.getElementById(data.panel).style.display = 'block';
            } else {
                toolConfigDiv.style.display = 'none';
            }

            // If switching from merge to another tool and there are multiple files, warn and clear
            if (!data.multiple && uploadedFiles.length > 1) {
                uploadedFiles = [uploadedFiles[0]]; // Keep only the first one
                renderFileList();
            }
            
            updateExecuteButton();
        });
    });

    // --- 2. FILE HANDLING LOGIC ---
    // Click to upload
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = ''; // trigger even if re-selecting same file
    });

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    function handleFiles(files) {
        if (!files || files.length === 0) return;
        
        let newFiles = Array.from(files).filter(f => f.type === 'application/pdf');
        
        if (newFiles.length === 0) {
            alert('Vui lòng chỉ chọn tệp PDF!');
            return;
        }

        if (!toolData[currentTool].multiple) {
            if (newFiles.length > 1) {
                alert('Công cụ này chỉ hỗ trợ xử lý 1 file cùng lúc. Đã lấy file đầu tiên.');
            }
            uploadedFiles = [newFiles[0]];
        } else {
            uploadedFiles = [...uploadedFiles, ...newFiles];
        }
        
        resultArea.style.display = 'none'; // hide results if new files added
        renderFileList();
    }

    function renderFileList() {
        fileList.innerHTML = '';
        uploadedFiles.forEach((file, index) => {
            const sizeKB = (file.size / 1024).toFixed(1);
            
            const item = document.createElement('div');
            item.className = 'file-item';
            
            let actionsObj = `<button class="btn-icon delete" onclick="removeFile(${index})"><i class="fa-solid fa-trash"></i></button>`;
            
            item.innerHTML = `
                <div class="file-info">
                    <i class="fa-solid fa-file-pdf"></i>
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${sizeKB} KB</div>
                    </div>
                </div>
                <div class="file-actions">
                    ${actionsObj}
                </div>
            `;
            fileList.appendChild(item);
        });

        // For Edit mode, open modal automatically if 1 file uploaded
        if (currentTool === 'edit' && uploadedFiles.length === 1) {
            openEditModal(uploadedFiles[0]);
        }

        updateExecuteButton();
    }

    window.removeFile = (index) => {
        uploadedFiles.splice(index, 1);
        renderFileList();
    };

    function updateExecuteButton() {
        if (uploadedFiles.length > 0) {
            btnExecute.disabled = false;
        } else {
            btnExecute.disabled = true;
        }
    }

    // --- 3. PDF PROCESSING LOGIC (CLIENT SIDE) ---
    btnExecute.addEventListener('click', async () => {
        if (uploadedFiles.length === 0) return;
        
        // Show loading
        btnExecute.disabled = true;
        statusBox.style.display = 'block';
        spinner.className = 'fa-solid fa-spinner fa-spin';
        statusText.innerText = 'Đang xử lý PDF cục bộ (ẩn danh)...';
        resultArea.style.display = 'none';
        downloadLinks.innerHTML = '';

        try {
            if (currentTool === 'merge') {
                await processMerge();
            } else if (currentTool === 'split') {
                await processSplit();
            } else if (currentTool === 'watermark') {
                await processWatermark();
            } else if (currentTool === 'edit') {
                alert('Vui lòng kéo thả lại file để mở Modal Chỉnh Sửa cho công cụ này.');
                resetUI();
                return;
            }

            statusText.innerText = 'Xử lý thành công!';
            spinner.className = 'fa-solid fa-check';
            resultArea.style.display = 'block';

        } catch (error) {
            console.error(error);
            statusText.innerText = 'Đã xảy ra lỗi trong quá trình xử lý!';
            spinner.className = 'fa-solid fa-circle-exclamation';
            alert('Lỗi: ' + error.message);
        } finally {
            btnExecute.disabled = false;
            // hide status after a bit
            setTimeout(() => { if(spinner.className.includes('check')) statusBox.style.display = 'none'; }, 3000);
        }
    });

    btnReset.addEventListener('click', resetUI);

    function resetUI() {
        uploadedFiles = [];
        renderFileList();
        resultArea.style.display = 'none';
        downloadLinks.innerHTML = '';
        statusBox.style.display = 'none';
        fileInput.value = '';
    }

    // PDF Tool: Merge
    async function processMerge() {
        const mergedPdf = await PDFDocument.create();
        for (const file of uploadedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        const pdfBytes = await mergedPdf.save();
        createDownloadLink(pdfBytes, 'Merged_Document.pdf');
    }

    // PDF Tool: Split
    async function processSplit() {
        const file = uploadedFiles[0];
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();
        const splitInput = document.getElementById('split-pages').value.trim();
        
        let targetPages = []; // 0-indexed
        
        if (splitInput === '') {
            // Default: Split all into singles -> create multiple downloads
            targetPages = Array.from({length: totalPages}, (_, i) => i);
            
            // Extract single pages
            statusText.innerText = 'Đang chia nhỏ từng trang...';
            for (let i = 0; i < targetPages.length; i++) {
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(pdfDoc, [targetPages[i]]);
                newPdf.addPage(copiedPage);
                const pdfBytes = await newPdf.save();
                createDownloadLink(pdfBytes, `Page_${targetPages[i] + 1}_${file.name}`);
            }
            return;
        } else {
            // Parse ranges: "1", "1,3", "1-3" (Convert to 0-index)
            const parts = splitInput.split(',');
            for (const part of parts) {
                if (part.includes('-')) {
                    const range = part.split('-');
                    let start = parseInt(range[0]) - 1;
                    let end = parseInt(range[1]) - 1;
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let k = start; k <= end; k++) {
                            if (k >= 0 && k < totalPages) targetPages.push(k);
                        }
                    }
                } else {
                    let pageIndex = parseInt(part) - 1;
                    if (!isNaN(pageIndex) && pageIndex >= 0 && pageIndex < totalPages) {
                        targetPages.push(pageIndex);
                    }
                }
            }
            
            targetPages = [...new Set(targetPages)].sort((a,b)=>a-b); // unique & sorted
            if(targetPages.length === 0) throw new Error("Phạm vi trang không hợp lệ!");
            
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, targetPages);
            copiedPages.forEach(p => newPdf.addPage(p));
            const pdfBytes = await newPdf.save();
            createDownloadLink(pdfBytes, `Extracted_${file.name}`);
        }
    }

    // PDF Tool: Watermark
    async function processWatermark() {
        const file = uploadedFiles[0];
        const text = document.getElementById('watermark-text').value.trim() || 'DungbuApps';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Setup font
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();
        
        for (const page of pages) {
            const { width, height } = page.getSize();
            const fontSize = 60;
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const textHeight = font.heightAtSize(fontSize);

            // Draw diagonally in center
            page.drawText(text, {
                x: width / 2 - textWidth / 2,
                y: height / 2 - textHeight / 2,
                size: fontSize,
                font: font,
                color: rgb(0.8, 0.2, 0.2), // Reddish
                opacity: 0.3, // Watermark transparency
                rotate: degrees(45), // Diagonal
            });
        }
        
        const pdfBytes = await pdfDoc.save();
        createDownloadLink(pdfBytes, `Watermarked_${file.name}`);
    }

    // Helper: Create blob and download link
    function createDownloadLink(uint8Array, filename) {
        const blob = new Blob([uint8Array], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.className = 'download-link-btn';
        a.innerHTML = `<i class="fa-solid fa-download"></i> Tải ${filename}`;
        
        downloadLinks.appendChild(a);
    }

    // --- 4. EDIT MODAL LOGIC ---
    const editModal = document.getElementById('edit-modal');
    const closeBtn = document.querySelector('.close-modal');
    const btnSaveEdit = document.getElementById('btn-save-edit');
    const btnAddBlank = document.getElementById('btn-add-blank');
    const pagesGrid = document.getElementById('pages-grid');

    let editPdfDoc = null; // Holds the PDFDocument object currently being edited
    let activeFileName = '';

    closeBtn.onclick = () => { editModal.style.display = "none"; }
    window.onclick = (e) => { if (e.target == editModal) editModal.style.display = "none"; }

    async function openEditModal(file) {
        activeFileName = file.name;
        statusBox.style.display = 'block';
        statusText.innerText = 'Đang đọc cấu trúc trang...';
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            editPdfDoc = await PDFDocument.load(arrayBuffer);
            renderEditGrid();
            editModal.style.display = 'block';
        } catch (e) {
            alert("Lỗi khi đọc file PDF: " + e.message);
        } finally {
            statusBox.style.display = 'none';
        }
    }

    function renderEditGrid() {
        pagesGrid.innerHTML = '';
        const pageCount = editPdfDoc.getPageCount();
        
        for (let i = 0; i < pageCount; i++) {
            const card = document.createElement('div');
            card.className = 'page-card';
            card.innerHTML = `
                <span class="page-num">Trang ${i + 1}</span>
                <div class="page-actions">
                    <button class="btn-icon" title="Xoay 90 độ" onclick="rotatePage(${i})"><i class="fa-solid fa-rotate-right"></i></button>
                    <button class="btn-icon delete" title="Xoá trang" onclick="deletePage(${i})"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            pagesGrid.appendChild(card);
        }
    }

    window.rotatePage = (index) => {
        const page = editPdfDoc.getPage(index);
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees(currentRotation + 90));
        // Visual feedback
        const card = pagesGrid.children[index];
        card.style.transform = \`rotate(2deg) scale(1.05)\`;
        setTimeout(() => card.style.transform = 'none', 300);
    }

    window.deletePage = (index) => {
        if(editPdfDoc.getPageCount() <= 1) {
            alert('File PDF phải có ít nhất 1 trang!');
            return;
        }
        editPdfDoc.removePage(index);
        renderEditGrid();
    }

    btnAddBlank.addEventListener('click', () => {
        const { width, height } = editPdfDoc.getPage(0).getSize();
        editPdfDoc.addPage([width, height]);
        renderEditGrid();
    });

    btnSaveEdit.addEventListener('click', async () => {
        btnSaveEdit.disabled = true;
        btnSaveEdit.innerText = 'Đang lưu...';
        try {
            const pdfBytes = await editPdfDoc.save();
            editModal.style.display = 'none';
            resultArea.style.display = 'block';
            downloadLinks.innerHTML = ''; // Clear old
            createDownloadLink(pdfBytes, `Edited_${activeFileName}`);
        } catch(e) {
            alert('Lỗi lưu PDF: ' + e.message);
        } finally {
            btnSaveEdit.disabled = false;
            btnSaveEdit.innerText = 'Lưu thay đổi';
        }
    });

});
