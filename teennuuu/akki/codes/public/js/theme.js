(function() {
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);

  // Sync across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
      document.documentElement.setAttribute('data-theme', e.newValue);
      const btn = document.getElementById("mobileThemeToggle");
      if(btn) btn.innerHTML = e.newValue === 'dark' ? '☀️' : '🌙';
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    // Check if there's already a static toggle in the header (like in donormod.html)
    if(document.getElementById("donormodThemeToggle")) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = "mobileThemeToggle";
    toggleBtn.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';
    toggleBtn.title = "Toggle Dark/Light Mode";
    toggleBtn.style.cssText = `
      position: fixed;
      bottom: 25px;
      right: 25px;
      width: 55px;
      height: 55px;
      border-radius: 50%;
      background: var(--toggle-bg, #1e293b);
      border: 2px solid var(--toggle-border, transparent);
      box-shadow: 0 5px 20px rgba(0,0,0,0.2);
      font-size: 26px;
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    `;
    
    toggleBtn.onmouseover = () => {
      toggleBtn.style.transform = 'scale(1.1) translateY(-5px)';
      toggleBtn.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
    };
    toggleBtn.onmouseout = () => {
      toggleBtn.style.transform = 'scale(1.0) translateY(0)';
      toggleBtn.style.boxShadow = '0 5px 20px rgba(0,0,0,0.2)';
    };

    toggleBtn.onclick = () => {
      const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      toggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    };

    document.body.appendChild(toggleBtn);
  });

  // REAL-TIME NOTIFICATIONS & NAVIGATION FIXES
  const script = document.createElement('script');
  script.src = "https://cdn.socket.io/4.7.4/socket.io.min.js";
  script.onload = () => {
    const socket = io();
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    if (currentUser && currentUser.phone) {
      socket.emit('register', currentUser.phone);
      
      // Fetch unread notifications on load
      fetch(`/api/notifications/${currentUser.phone}`)
        .then(res => res.json())
        .then(data => {
          const unread = data.filter(n => !n.isRead);
          unread.forEach((notif, index) => {
            setTimeout(() => {
              showGlobalToast(notif.text);
              fetch(`/api/notifications/${notif._id}/read`, { method: 'PUT' });
            }, index * 1500); // Stagger toasts if multiple
          });
        })
        .catch(err => console.error(err));
    }

    socket.on('notification', (notif) => {
      showGlobalToast(notif.text);
      if (notif._id) {
         fetch(`/api/notifications/${notif._id}/read`, { method: 'PUT' }).catch(() => {});
      }
    });
  };
  document.head.appendChild(script);

  function showGlobalToast(message) {
    const toast = document.createElement('div');
    toast.className = "global-notification-toast";
    toast.innerText = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      padding: 16px 32px;
      border-radius: 50px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.3);
      z-index: 10000;
      font-weight: 600;
      font-size: 15px;
      opacity: 0;
      transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    }, 100);

    // Animate out
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => toast.remove(), 500);
    }, 5000);
  }

  // Disable Side Mouse Buttons (Back/Forward)
  window.addEventListener("mouseup", (e) => {
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

})();
