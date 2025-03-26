/**
 * MessBlocker - Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the application
  const app = new MessBlockerApp();
  app.init();
});

class MessBlockerApp {
  constructor() {
    // App state
    this.categories = [];
    this.selectedCategory = null;
    this.lists = {};
    this.searchQuery = '';
    this.searchResults = [];
    this.currentPage = 1;
    this.pageSize = 20;
    this.isLoading = true;
    this.isCategoryLoading = false;
    this.isSearching = false;
    this.showWelcome = true;
    
    // API Endpoints
    this.apiBase = 'https://api.messblocker.com/api';
    this.endpointCategories = `${this.apiBase}/categories`;
    this.endpointList = (file) => `${this.apiBase}/list/${file}`;
    this.endpointSearch = (query) => `${this.apiBase}/search?q=${encodeURIComponent(query)}`;
    
    // DOM elements - cached for performance
    this.elements = {
      // Main containers
      loadingState: document.getElementById('loading-state'),
      welcomeView: document.getElementById('welcome-view'),
      categoryView: document.getElementById('category-view'),
      searchResults: document.getElementById('search-results'),
      emptyState: document.getElementById('empty-state'),
      
      // Tabs
      tabsScroll: document.getElementById('tabs-scroll'),
      tabScrollLeft: document.getElementById('tab-scroll-left'),
      tabScrollRight: document.getElementById('tab-scroll-right'),
      
      // Search
      searchInput: document.getElementById('search-input'),
      clearSearch: document.getElementById('clear-search'),
      searchCount: document.getElementById('search-count'),
      searchGrid: document.getElementById('search-grid'),
      copySearchBtn: document.getElementById('copy-search-results'),
      
      // Category view
      categoryTitle: document.getElementById('category-title'),
      categoryCount: document.getElementById('category-count'),
      usernameGrid: document.getElementById('username-grid'),
      copyAllBtn: document.getElementById('copy-all-btn'),
      
      // Pagination
      pagination: document.getElementById('pagination'),
      paginationInfo: document.getElementById('pagination-info'),
      prevPage: document.getElementById('prev-page'),
      nextPage: document.getElementById('next-page'),
      
      // Empty state
      emptyStateTitle: document.getElementById('empty-state-title'),
      emptyStateMessage: document.getElementById('empty-state-message'),
      
      // Toast
      toast: document.getElementById('toast'),
      toastMessage: document.getElementById('toast-message'),
      
      // Theme toggle
      themeToggle: document.getElementById('theme-toggle'),
    };
    
    // Debounce timers
    this.searchDebounceTimer = null;
    this.toastTimer = null;
    
    // Bind methods to this instance
    this.toggleDarkMode = this.toggleDarkMode.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.clearSearch = this.clearSearch.bind(this);
    this.selectCategory = this.selectCategory.bind(this);
    this.copyUsername = this.copyUsername.bind(this);
    this.copyAllUsernames = this.copyAllUsernames.bind(this);
    this.copySearchResults = this.copySearchResults.bind(this);
    this.handleKeyboardShortcuts = this.handleKeyboardShortcuts.bind(this);
    this.goToNextPage = this.goToNextPage.bind(this);
    this.goToPrevPage = this.goToPrevPage.bind(this);
    this.handleTabScroll = this.handleTabScroll.bind(this);
    this.checkScrollIndicators = this.checkScrollIndicators.bind(this);
  }
  
  async init() {
    try {
      // Initialize theme
      this.initializeTheme();
      
      // Add event listeners
      this.addEventListeners();
      
      // Check URL parameters
      this.urlParams = new URLSearchParams(window.location.search);
      
      // Fetch categories first
      await this.fetchCategories();
      
      // Handle initial URL state (category or search)
      await this.handleUrlState();
      
      // Register popstate listener
      window.addEventListener('popstate', this.handleUrlState.bind(this));
      
    } catch (error) {
      console.error('Error initializing app:', error);
      this.showEmptyState('Something went wrong', 'Please try again later');
    } finally {
      // Hide loading state
      this.isLoading = false;
      this.updateUI();
    }
  }
  
  initializeTheme() {
    // Check if dark mode is stored in localStorage
    const storedTheme = localStorage.getItem('messblocker-theme');
    
    if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (storedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('messblocker-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('messblocker-theme', 'light');
      }
    }
  }
  
  toggleDarkMode() {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('messblocker-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('messblocker-theme', 'dark');
    }
  }
  
  addEventListeners() {
    // Theme toggle
    this.elements.themeToggle.addEventListener('click', this.toggleDarkMode);
    
    // Search
    this.elements.searchInput.addEventListener('input', () => {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(this.handleSearch, 300);
    });
    this.elements.clearSearch.addEventListener('click', this.clearSearch);
    
    // Copy buttons
    this.elements.copyAllBtn.addEventListener('click', this.copyAllUsernames);
    this.elements.copySearchBtn.addEventListener('click', this.copySearchResults);
    
    // Pagination
    this.elements.prevPage.addEventListener('click', this.goToPrevPage);
    this.elements.nextPage.addEventListener('click', this.goToNextPage);
    
    // Keyboard shortcuts
    window.addEventListener('keydown', this.handleKeyboardShortcuts);
    
    // Tab scroll indicators
    this.elements.tabScrollLeft.addEventListener('click', () => {
      this.elements.tabsScroll.scrollBy({ left: -200, behavior: 'smooth' });
    });
    this.elements.tabScrollRight.addEventListener('click', () => {
      this.elements.tabsScroll.scrollBy({ left: 200, behavior: 'smooth' });
    });
    
    // Check scroll indicators when tab container scrolls
    this.elements.tabsScroll.addEventListener('scroll', this.checkScrollIndicators);
    window.addEventListener('resize', this.checkScrollIndicators);
  }
  
  handleKeyboardShortcuts(event) {
    // '/' to focus search
    if (event.key === '/' && document.activeElement !== this.elements.searchInput) {
      event.preventDefault();
      this.elements.searchInput.focus();
    }
    
    // 'Escape' to clear search
    if (event.key === 'Escape' && this.searchQuery) {
      this.clearSearch();
    }
  }
  
  async handleUrlState() {
    this.urlParams = new URLSearchParams(window.location.search);
    const categoryParam = this.urlParams.get('category');
    const searchParam = this.urlParams.get('search');
    
    if (searchParam) {
      // Handle search from URL
      this.elements.searchInput.value = searchParam;
      this.searchQuery = searchParam;
      await this.search(searchParam);
      // Hide welcome page when searching
      this.showWelcome = false;
    } else if (categoryParam && this.categories.length > 0) {
      // Find category by name (case insensitive)
      const category = this.categories.find(cat => 
        cat.name.toLowerCase() === categoryParam.toLowerCase()
      );
      
      if (category) {
        await this.selectCategory(category);
        // Hide welcome page when showing a category
        this.showWelcome = false;
      } else {
        // If category not found, show welcome page
        this.showWelcome = true;
      }
    } else {
      // Default: show welcome page
      this.showWelcome = true;
    }
  }
  
  updateUrl() {
    const params = new URLSearchParams();
    
    if (this.searchQuery) {
      params.set('search', this.searchQuery);
    } else if (this.selectedCategory && !this.showWelcome) {
      params.set('category', this.selectedCategory.name);
    }
    
    const url = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.pushState({ url }, '', url);
  }
  
  async fetchCategories() {
    try {
      const response = await fetch(this.endpointCategories);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }
      
      this.categories = await response.json();
      this.renderTabs();
      
    } catch (error) {
      console.error('Error fetching categories:', error);
      this.showEmptyState('Failed to load categories', 'Please try again later');
    }
  }
  
  renderTabs() {
    // Clear existing tabs
    this.elements.tabsScroll.innerHTML = '';
    
    // Create tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tabs';
    
    // Add tabs for each category
    this.categories.forEach(category => {
      const tab = document.createElement('button');
      tab.className = 'tab';
      tab.textContent = category.name;
      tab.setAttribute('data-category', category.file);
      tab.addEventListener('click', () => {
        this.selectCategory(category);
        // Hide welcome page when a category is selected
        this.showWelcome = false;
      });
      
      tabsContainer.appendChild(tab);
    });
    
    // Append tabs to container
    this.elements.tabsScroll.appendChild(tabsContainer);
    
    // Check if scroll indicators should be shown
    this.checkScrollIndicators();
  }
  
  checkScrollIndicators() {
    const { scrollLeft, scrollWidth, clientWidth } = this.elements.tabsScroll;
    
    // Show/hide left indicator
    if (scrollLeft > 0) {
      this.elements.tabScrollLeft.style.display = 'flex';
    } else {
      this.elements.tabScrollLeft.style.display = 'none';
    }
    
    // Show/hide right indicator
    if (scrollLeft + clientWidth < scrollWidth - 5) { // 5px tolerance
      this.elements.tabScrollRight.style.display = 'flex';
    } else {
      this.elements.tabScrollRight.style.display = 'none';
    }
  }
  
  handleTabScroll() {
    this.checkScrollIndicators();
  }
  
  async selectCategory(category) {
    if (this.isCategoryLoading) return;
    
    try {
      this.isSearching = false;
      this.selectedCategory = category;
      this.currentPage = 1;
      this.isCategoryLoading = true;
      this.updateUI();
      
      // Update active tab
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach(tab => {
        if (tab.getAttribute('data-category') === category.file) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
      
      // Load data if not already loaded
      if (!this.lists[category.file]) {
        await this.fetchList(category.file);
      }
      
      // Update URL
      this.updateUrl();
      
    } catch (error) {
      console.error(`Error selecting category ${category.name}:`, error);
      this.showEmptyState('Failed to load category', 'Please try again later');
    } finally {
      this.isCategoryLoading = false;
      this.updateUI();
    }
  }
  
  async fetchList(file) {
    try {
      const response = await fetch(this.endpointList(file));
      
      if (!response.ok) {
        throw new Error(`Failed to fetch list: ${response.status}`);
      }
      
      this.lists[file] = await response.json();
      
    } catch (error) {
      console.error(`Error fetching list ${file}:`, error);
      throw error;
    }
  }
  
  async handleSearch() {
    const query = this.elements.searchInput.value.trim();
    
    if (query === this.searchQuery) return;
    
    this.searchQuery = query;
    
    if (!query) {
      // Clear search and show welcome or selected category
      this.clearSearch();
      return;
    }
    
    // Hide welcome page when searching
    this.showWelcome = false;
    await this.search(query);
  }
  
  async search(query) {
    try {
      this.isSearching = true;
      // Reset to page 1 when starting a new search
      this.currentPage = 1;
      this.updateUI();
      
      const response = await fetch(this.endpointSearch(query));
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      this.searchResults = await response.json();
      
      // Update URL
      this.updateUrl();
      
    } catch (error) {
      console.error('Search error:', error);
      this.showEmptyState('Search failed', 'Please try again later');
    } finally {
      this.updateUI();
    }
  }
  
  clearSearch() {
    this.elements.searchInput.value = '';
    this.searchQuery = '';
    this.searchResults = [];
    this.isSearching = false;
    this.currentPage = 1; // Reset page number
    
    // Return to welcome or selected category
    this.updateUrl();
    
    // Update UI
    this.updateUI();
  }
  
  updateUI() {
    // Hide all views initially
    this.elements.loadingState.classList.add('hidden');
    this.elements.welcomeView.classList.add('hidden');
    this.elements.categoryView.classList.add('hidden');
    this.elements.searchResults.classList.add('hidden');
    this.elements.emptyState.classList.add('hidden');
    this.elements.pagination.classList.add('hidden');
    
    // Show appropriate view based on state
    if (this.isLoading) {
      this.elements.loadingState.classList.remove('hidden');
    } else if (this.isSearching) {
      this.renderSearchResults();
      this.elements.searchResults.classList.remove('hidden');
      
      // Show pagination for search if needed (more than one page)
      if (this.searchResults.length > this.pageSize) {
        this.elements.pagination.classList.remove('hidden');
      }
    } else if (this.showWelcome) {
      this.elements.welcomeView.classList.remove('hidden');
    } else if (this.selectedCategory) {
      this.renderCategoryView();
      this.elements.categoryView.classList.remove('hidden');
    }
    
    // Show/hide clear search button
    if (this.searchQuery) {
      this.elements.clearSearch.style.display = 'flex';
    } else {
      this.elements.clearSearch.style.display = 'none';
    }
  }
  
  renderCategoryView() {
    const category = this.selectedCategory;
    if (!category) return;
    
    const usernames = this.lists[category.file] || [];
    
    // Update header
    this.elements.categoryTitle.textContent = category.name;
    this.elements.categoryCount.textContent = `${usernames.length} usernames`;
    
    // Calculate pagination
    const totalPages = Math.ceil(usernames.length / this.pageSize);
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, usernames.length);
    const currentUsernames = usernames.slice(start, end);
    
    // Update pagination UI
    this.elements.paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
    this.elements.prevPage.disabled = this.currentPage <= 1;
    this.elements.nextPage.disabled = this.currentPage >= totalPages;
    
    // Show/hide pagination
    if (totalPages <= 1) {
      this.elements.pagination.classList.add('hidden');
    } else {
      this.elements.pagination.classList.remove('hidden');
    }
    
    // Render username grid
    this.renderUsernameGrid(currentUsernames);
    
    // Show empty state if no usernames
    if (usernames.length === 0) {
      this.showEmptyState('No usernames in this category', 'Check back later for updates');
    }
  }
  
  renderUsernameGrid(usernames) {
    this.elements.usernameGrid.innerHTML = '';
    
    usernames.forEach(username => {
      const card = document.createElement('div');
      card.className = 'username-card';
      
      const usernameLink = document.createElement('a');
      usernameLink.className = 'username-text';
      usernameLink.href = `https://x.com/${username}`;
      usernameLink.target = '_blank';
      usernameLink.rel = 'noopener noreferrer';
      usernameLink.textContent = `@${username}`;
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.setAttribute('aria-label', `Copy ${username}`);
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      `;
      copyBtn.addEventListener('click', () => this.copyUsername(username));
      
      card.appendChild(usernameLink);
      card.appendChild(copyBtn);
      
      this.elements.usernameGrid.appendChild(card);
    });
  }
  
  renderSearchResults() {
    const results = this.searchResults;
    
    // Update header
    this.elements.searchCount.textContent = `${results.length} matches found`;
    
    // Calculate pagination for search results
    const totalPages = Math.ceil(results.length / this.pageSize);
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, results.length);
    const currentResults = results.slice(start, end);
    
    // Update pagination UI
    this.elements.paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
    this.elements.prevPage.disabled = this.currentPage <= 1;
    this.elements.nextPage.disabled = this.currentPage >= totalPages;
    
    // Show/hide pagination
    if (totalPages <= 1) {
      this.elements.pagination.classList.add('hidden');
    } else {
      this.elements.pagination.classList.remove('hidden');
    }
    
    // Render search results grid
    this.elements.searchGrid.innerHTML = '';
    
    if (results.length === 0) {
      this.showEmptyState('No matching usernames found', 'Try a different search term');
      return;
    }
    
    // Only render the current page of results
    currentResults.forEach(result => {
      const card = document.createElement('div');
      card.className = 'username-card search-card';
      
      const usernameLink = document.createElement('a');
      usernameLink.className = 'username-text';
      usernameLink.href = `https://x.com/${result.username}`;
      usernameLink.target = '_blank';
      usernameLink.rel = 'noopener noreferrer';
      usernameLink.innerHTML = `@${this.highlightMatch(result.username, this.searchQuery)}`;
      
      const categoryTag = document.createElement('span');
      categoryTag.className = 'category-tag';
      categoryTag.textContent = result.category;
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.setAttribute('aria-label', `Copy ${result.username}`);
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      `;
      copyBtn.addEventListener('click', () => this.copyUsername(result.username));
      
      card.appendChild(usernameLink);
      card.appendChild(categoryTag);
      card.appendChild(copyBtn);
      
      this.elements.searchGrid.appendChild(card);
    });
  }
  
  highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }
  
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  showEmptyState(title, message) {
    this.elements.emptyStateTitle.textContent = title;
    this.elements.emptyStateMessage.textContent = message;
    this.elements.emptyState.classList.remove('hidden');
  }
  
  copyUsername(username) {
    navigator.clipboard.writeText(username)
      .then(() => {
        this.showToast(`Copied @${username}`);
      })
      .catch(err => {
        console.error('Could not copy text:', err);
        this.showToast('Failed to copy to clipboard');
      });
  }
  
  copyAllUsernames() {
    if (!this.selectedCategory) return;
    
    const usernames = this.lists[this.selectedCategory.file] || [];
    if (usernames.length === 0) return;
    
    const text = usernames.join('\n');
    
    navigator.clipboard.writeText(text)
      .then(() => {
        this.showToast(`Copied all ${usernames.length} usernames`);
      })
      .catch(err => {
        console.error('Could not copy text:', err);
        this.showToast('Failed to copy to clipboard');
      });
  }
  
  copySearchResults() {
    if (this.searchResults.length === 0) return;
    
    const text = this.searchResults.map(result => result.username).join('\n');
    
    navigator.clipboard.writeText(text)
      .then(() => {
        this.showToast(`Copied all ${this.searchResults.length} usernames`);
      })
      .catch(err => {
        console.error('Could not copy text:', err);
        this.showToast('Failed to copy to clipboard');
      });
  }
  
  showToast(message) {
    clearTimeout(this.toastTimer);
    
    this.elements.toastMessage.textContent = message;
    this.elements.toast.classList.remove('hidden');
    
    this.toastTimer = setTimeout(() => {
      this.elements.toast.classList.add('hidden');
    }, 2000);
  }
  
  goToNextPage() {
    if (this.isSearching) {
      const totalPages = Math.ceil(this.searchResults.length / this.pageSize);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderSearchResults();
        this.elements.searchGrid.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (this.selectedCategory) {
      const usernames = this.lists[this.selectedCategory.file] || [];
      const totalPages = Math.ceil(usernames.length / this.pageSize);
      
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderCategoryView();
        this.elements.usernameGrid.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }
  
  goToPrevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      
      if (this.isSearching) {
        this.renderSearchResults();
        this.elements.searchGrid.scrollIntoView({ behavior: 'smooth' });
      } else {
        this.renderCategoryView();
        this.elements.usernameGrid.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }
}