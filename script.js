import confetti from 'confetti';

document.addEventListener('DOMContentLoaded', function() {
    // State variables
    let notes = JSON.parse(localStorage.getItem('notes')) || [];
    let userName = localStorage.getItem('userName') || '';
    let selectedNoteId = null;
    let selectedColor = '#fff9c4'; // Default light yellow
    let dragSrcEl = null;
    let currentBackground = localStorage.getItem('background') || 'clouds';
    let darkMode = localStorage.getItem('darkMode') === 'true';

    // DOM elements
    const boardTitleElement = document.getElementById('board-title');
    const notesContainer = document.getElementById('notes-container');
    const backgroundSelect = document.getElementById('background-select');
    const userDisplayName = document.getElementById('user-display-name');

    // Initialize the app
    init();

    function init() {
        // Apply dark mode by default
        document.body.classList.add('dark-mode');
        darkMode = true;
        localStorage.setItem('darkMode', 'true');
        
        // Override default alert with custom styling
        window.alert = function(message) {
            const customAlert = document.createElement('div');
            customAlert.classList.add('custom-alert');
            customAlert.innerHTML = `
                <div class="alert-content">
                    <p>${message}</p>
                    <button class="alert-button">OK</button>
                </div>
            `;
            document.body.appendChild(customAlert);
            
            const okButton = customAlert.querySelector('.alert-button');
            okButton.addEventListener('click', () => {
                document.body.removeChild(customAlert);
            });
        };
        
        // Update icon to show sun since we're in dark mode
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.className = 'fas fa-sun';
        }

        // Load and display board title
        const savedBoardTitle = localStorage.getItem('boardTitle') || 'Your Board Title';
        if (boardTitleElement) {
            boardTitleElement.textContent = savedBoardTitle;
        }

        // Set background
        setBackground(currentBackground);
        if (backgroundSelect) {
            backgroundSelect.value = currentBackground;
        }

        // Create stars for the starry night background
        createStars();

        // Add cork texture for cork board background
        createCorkTexture();

        // Display all notes at start
        displayNotes();

        // If no username is set, show the name prompt
        if (!userName) {
            showNamePromptModal();
        }

        // Set user display name
        if (userDisplayName) {
            userDisplayName.textContent = userName || 'Guest';
        }

        // Initialize event listeners
        initEventListeners();
    }

    function initEventListeners() {
        // Board title editing
        boardTitleElement.addEventListener('click', makeEditable);
        boardTitleElement.addEventListener('blur', saveTitle);
        boardTitleElement.addEventListener('keydown', handleTitleKeydown);

        // Button controls
        document.getElementById('add-note').addEventListener('click', addNewNote);
        document.getElementById('config-button').addEventListener('click', openConfigModal);

        // Toolbar buttons
        document.getElementById('add-note-toolbar').addEventListener('click', addNewNote);
        document.getElementById('download-notes-toolbar').addEventListener('click', downloadNotes);
        document.getElementById('config-button-toolbar').addEventListener('click', openConfigModal);
        document.getElementById('theme-toggle').addEventListener('click', toggleDarkMode);

        // Modal controls
        document.getElementById('note-modal-close').addEventListener('click', () => closeModal('note-modal'));
        document.getElementById('config-modal-close').addEventListener('click', () => closeModal('config-modal'));
        document.getElementById('save-note').addEventListener('click', saveNote);
        document.getElementById('delete-note').addEventListener('click', confirmDeleteNote);
        document.getElementById('save-config').addEventListener('click', saveConfig);
        document.getElementById('download-notes').addEventListener('click', downloadNotes);
        document.getElementById('clear-all').addEventListener('click', confirmClearAllNotes);
        document.getElementById('save-user-name').addEventListener('click', saveUserName);
        document.getElementById('confirm-yes').addEventListener('click', handleConfirmation);
        document.getElementById('confirm-no').addEventListener('click', () => closeModal('confirm-modal'));

        // Color picker
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => selectColor(option.getAttribute('data-color')));
        });

        // Add event listeners for note tags
        document.querySelectorAll('.note-tag-item').forEach(item => {
            item.addEventListener('click', function() {
                // Toggle active state
                document.querySelectorAll('.note-tag-item').forEach(tag => {
                    tag.classList.remove('active');
                });
                this.classList.add('active');
            });
        });

        // Background selection
        if (backgroundSelect) {
            backgroundSelect.addEventListener('change', function() {
                setBackground(this.value);
            });
        }

        // Character counter
        document.getElementById('note-content').addEventListener('input', function() {
            updateCharCounter(this.value.length);
        });
    }

    function toggleDarkMode() {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', darkMode);

        // Update icon
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = darkMode ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Note display and management functions
    function displayNotes() {
        notesContainer.innerHTML = '';

        if (notes.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = '<i class="fas fa-sticky-note"></i><p>No notes yet! Click the + button to add one.</p>';
            notesContainer.appendChild(emptyState);
            return;
        }

        notes.forEach(function(note) {
            createNoteElement(note);
        });
    }

    function createNoteElement(note, animate = false) {
        const noteDiv = document.createElement('div');
        noteDiv.classList.add('note');
        if (animate) {
            noteDiv.classList.add('pop-in');
        }

        noteDiv.style.backgroundColor = hexToRGBA(note.color, 0.9);
        noteDiv.setAttribute('data-id', note.id);
        noteDiv.setAttribute('draggable', 'true');

        // Set rotation
        let rotationDegree = note.rotationDegree !== undefined ? note.rotationDegree : Math.floor(Math.random() * 5) - 2;
        note.rotationDegree = rotationDegree;
        noteDiv.style.transform = `rotate(${rotationDegree}deg)`;

        // Note category/tag badge (displayed at top)
        if (note.tag) {
            const noteCategoryBadge = document.createElement('div');
            noteCategoryBadge.classList.add('note-category-badge');
            noteCategoryBadge.textContent = note.tag;
            noteDiv.appendChild(noteCategoryBadge);
        }

        // Note content
        const noteContentDiv = document.createElement('div');
        noteContentDiv.classList.add('note-text');
        noteContentDiv.textContent = note.content;
        noteDiv.appendChild(noteContentDiv);

        // Note tag (user name) - still keep this at bottom
        const noteTagDiv = document.createElement('div');
        noteTagDiv.classList.add('note-tag');
        noteTagDiv.textContent = note.tag || '';
        noteDiv.appendChild(noteTagDiv);

        // Event listeners
        noteDiv.addEventListener('click', () => openNoteModal(note.id));
        noteDiv.addEventListener('dragstart', handleDragStart);
        noteDiv.addEventListener('dragover', handleDragOver);
        noteDiv.addEventListener('drop', handleDrop);
        noteDiv.addEventListener('dragend', handleDragEnd);

        notesContainer.appendChild(noteDiv);
    }

    function addNewNote() {
        selectedNoteId = null;
        document.getElementById('note-content').value = '';
        updateCharCounter(0);
        selectColor('#fff9c4');
        document.getElementById('delete-note').style.display = 'none';
        showModal('note-modal');
    }

    function openNoteModal(id) {
        selectedNoteId = id;
        const note = notes.find(n => n.id === id);
        
        // Update modal title based on whether we're creating or editing
        document.querySelector('#note-modal h2').innerHTML = id ? 
            '<i class="fas fa-edit" title="Edit Note"></i> Edit Note' : 
            '<i class="fas fa-sticky-note" title="Add Note"></i> Create Note';
        
        // Display current date in the note editor
        const dateElement = document.getElementById('note-edit-date');
        const now = new Date();
        dateElement.textContent = now.toLocaleDateString();
        
        if (note) {
            document.getElementById('note-content').value = note.content;
            updateCharCounter(note.content.length);
            selectColor(note.color);
            
            // Select appropriate tag if it exists
            if (note.tag) {
                document.querySelectorAll('.note-tag-item').forEach(item => {
                    if (item.dataset.tag === note.tag) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });
            }
            
            document.getElementById('delete-note').style.display = 'inline-block';
        } else {
            document.getElementById('note-content').value = '';
            updateCharCounter(0);
            selectColor('#fff9c4');
            document.querySelectorAll('.note-tag-item').forEach(item => {
                item.classList.remove('active');
            });
            document.getElementById('delete-note').style.display = 'none';
        }
        
        showModal('note-modal');
    }

    function saveNote() {
        const content = document.getElementById('note-content').value.trim();
        const MAX_CHARS = 250;
        
        if (!content) {
            alert('Please enter some content for your note');
            return;
        }
        
        if (content.length > MAX_CHARS) {
            alert(`Note content exceeds maximum character limit of ${MAX_CHARS}`);
            return;
        }
        
        // Get selected tag
        let selectedTag = '';
        const activeTag = document.querySelector('.note-tag-item.active');
        if (activeTag) {
            selectedTag = activeTag.dataset.tag;
        }
        
        if (selectedNoteId) {
            // Update existing note
            notes = notes.map(function(note) {
                if (note.id === selectedNoteId) {
                    return {
                        ...note,
                        content: content,
                        color: selectedColor,
                        tag: selectedTag || userName
                    };
                }
                return note;
            });
        } else {
            // Create new note
            const rotationDegree = Math.floor(Math.random() * 5) - 2;

            const note = {
                id: Date.now(),
                content: content,
                color: selectedColor,
                tag: selectedTag || userName,
                rotationDegree: rotationDegree
            };

            notes.push(note);

            // Show confetti for new note
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        localStorage.setItem('notes', JSON.stringify(notes));
        closeModal('note-modal');
        displayNotes();
    }

    function confirmDeleteNote() {
        document.getElementById('confirm-message').textContent = 'Are you sure you want to delete this note?';
        document.getElementById('confirm-yes').dataset.action = 'delete-note';
        showModal('confirm-modal');
    }

    function deleteNote() {
        if (selectedNoteId) {
            notes = notes.filter(note => note.id !== selectedNoteId);
            localStorage.setItem('notes', JSON.stringify(notes));
            closeModal('note-modal');
            displayNotes();
        }
    }

    function confirmClearAllNotes() {
        document.getElementById('confirm-message').textContent = 'Are you sure you want to delete ALL notes? This cannot be undone.';
        document.getElementById('confirm-yes').dataset.action = 'clear-all';
        showModal('confirm-modal');
    }

    function clearAllNotes() {
        notes = [];
        localStorage.setItem('notes', JSON.stringify(notes));
        closeModal('config-modal');
        displayNotes();
    }

    // Drag and drop functionality
    function handleDragStart(e) {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
        this.classList.add('dragging');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDrop(e) {
        e.stopPropagation();

        if (dragSrcEl !== this) {
            const srcId = dragSrcEl.getAttribute('data-id');
            const destId = this.getAttribute('data-id');

            const srcIndex = notes.findIndex(note => note.id == srcId);
            const destIndex = notes.findIndex(note => note.id == destId);

            const [movedNote] = notes.splice(srcIndex, 1);
            notes.splice(destIndex, 0, movedNote);

            localStorage.setItem('notes', JSON.stringify(notes));
            displayNotes();
        }
        return false;
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
    }

    // Configuration functions
    function openConfigModal() {
        document.getElementById('user-name').value = userName;
        showModal('config-modal');
    }

    function saveConfig() {
        const newUserName = document.getElementById('user-name').value.trim();
        const newBackground = backgroundSelect.value;

        if (newUserName) {
            userName = newUserName;
            localStorage.setItem('userName', userName);
            userDisplayName.textContent = userName;
        }

        if (newBackground !== currentBackground) {
            setBackground(newBackground);
            localStorage.setItem('background', newBackground);
            currentBackground = newBackground;
        }

        closeModal('config-modal');
    }

    function saveUserName() {
        userName = document.getElementById('prompt-user-name').value.trim();
        if (userName) {
            localStorage.setItem('userName', userName);
            userDisplayName.textContent = userName;
            closeModal('name-modal');
        } else {
            alert('Please enter your name');
        }
    }

    function downloadNotes() {
        if (notes.length === 0) {
            alert('No notes to download.');
            return;
        }

        let content = 'Tag,Text\n';
        notes.forEach(function(note) {
            let tag = note.tag ? note.tag.replace(/"/g, '""') : '';
            let text = note.content.replace(/"/g, '""');
            content += `"${tag}","${text}"\n`;
        });

        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.setAttribute('href', url);
        link.setAttribute('download', 'notes.csv');
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Background management
    function setBackground(type) {
        document.body.classList.remove('starry-night', 'cork-board');

        if (type === 'stars') {
            document.body.classList.add('starry-night');
        } else if (type === 'cork') {
            document.body.classList.add('cork-board');
        }
    }

    function createStars() {
        const backgroundScene = document.querySelector('.background-scene');
        if (!backgroundScene) return;

        // Create 100 stars with random positions and animations
        for (let i = 0; i < 100; i++) {
            const star = document.createElement('div');
            star.classList.add('star');

            // Random size between 1-3px
            const size = Math.random() * 2 + 1;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;

            // Random position
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;

            // Random animation delay
            const animationDelay = Math.random() * 5;
            star.style.animation = `twinkle ${3 + Math.random() * 4}s ease-in-out ${animationDelay}s infinite`;

            backgroundScene.appendChild(star);
        }
    }

    function createCorkTexture() {
        const backgroundScene = document.querySelector('.background-scene');
        if (!backgroundScene) return;
        const corkTexture = document.createElement('div');
        corkTexture.classList.add('cork-texture');
        backgroundScene.appendChild(corkTexture);
    }

    // UI Helpers
    function makeEditable() {
        this.setAttribute('contenteditable', 'true');
        this.focus();
    }

    function saveTitle() {
        this.removeAttribute('contenteditable');
        const newBoardTitle = this.textContent.trim() || 'Your Board Title';
        this.textContent = newBoardTitle;
        localStorage.setItem('boardTitle', newBoardTitle);
    }

    function handleTitleKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.blur();
        }
    }

    function selectColor(color) {
        selectedColor = color;
        document.querySelectorAll('.color-option').forEach(function(option) {
            option.classList.remove('selected');
            if (option.getAttribute('data-color') === color) {
                option.classList.add('selected');
                
                // Add visual feedback when color is selected
                const ripple = document.createElement('div');
                ripple.classList.add('ripple-effect');
                option.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 500);
            }
        });
        
        // Preview note color change
        document.getElementById('note-content').style.borderColor = color;
    }

    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'block';
        
        // Add entrance animation
        const modalContent = modal.querySelector('.modal-content');
        modalContent.style.opacity = '0';
        modalContent.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            modalContent.style.opacity = '1';
            modalContent.style.transform = 'scale(1)';
        }, 10);
        
        // Focus on content area for note modal
        if (modalId === 'note-modal') {
            setTimeout(() => {
                document.getElementById('note-content').focus();
            }, 300);
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        const modalContent = modal.querySelector('.modal-content');
        
        // Add exit animation
        modalContent.style.opacity = '0';
        modalContent.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            modal.style.display = 'none';
            modalContent.style.opacity = '1';
            modalContent.style.transform = 'scale(1)';
        }, 300);
    }

    function showNamePromptModal() {
        showModal('name-modal');
    }

    function handleConfirmation() {
        const action = document.getElementById('confirm-yes').dataset.action;

        if (action === 'delete-note') {
            deleteNote();
        } else if (action === 'clear-all') {
            clearAllNotes();
        }

        closeModal('confirm-modal');
    }

    function updateCharCounter(length) {
        const counter = document.querySelector('.char-counter');
        const MAX_CHARS = 250;
        counter.textContent = `${length}/${MAX_CHARS} characters`;
        
        // Visual feedback
        counter.classList.remove('limit-near', 'limit-reached');
        if (length > MAX_CHARS * 0.8 && length <= MAX_CHARS) {
            counter.classList.add('limit-near');
        } else if (length > MAX_CHARS) {
            counter.classList.add('limit-reached');
        }
    }

    // Utility functions
    function hexToRGBA(hex, alpha) {
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c = hex.substring(1).split('');
            if(c.length == 3){
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x'+c.join('');
            return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${alpha})`;
        }
        return hex;
    }
});