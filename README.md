
# 🎯 HSK 4 Vocabulary Quiz

A modern, mobile-optimized vocabulary quiz app for Chinese HSK Level 4 exam preparation. Features intelligent question generation, dark/light themes, and comprehensive progress tracking.

![HSK 4 Quiz Demo](https://img.shields.io/badge/Demo-Live-brightgreen) ![Mobile Optimized](https://img.shields.io/badge/Mobile-Optimized-blue) ![Dark Theme](https://img.shields.io/badge/Theme-Dark%2FLight-purple) ![Progressive Web App](https://img.shields.io/badge/PWA-Ready-orange)

## ✨ Features

### 🎮 **Interactive Learning**
- **Smart Question Generation** - AI-powered similar options based on pinyin pronunciation, tones, and meaning similarity
- **Dual Quiz Modes** - Switch between Pinyin + English matching or English-only mode
- **Touch-Optimized Interface** - Designed for mobile-first experience with haptic feedback
- **Instant Feedback** - Real-time results with visual and haptic responses

### 📚 **Adaptive Study System**
- **Flexible Batch Sizes** - Study 25, 50, 100 words, or all vocabulary at once
- **Wrong Answer Review** - Automatic collection and focused practice of missed questions
- **Progress Persistence** - Never lose your place with auto-save functionality
- **Batch Navigation** - Seamlessly move between vocabulary sets

### 🎨 **Modern UI/UX**
- **Dark/Light Theme** - Toggle between themes with smooth transitions
- **Responsive Design** - Perfect experience on phones, tablets, and desktop
- **Progressive Web App** - Install on mobile devices for app-like experience
- **Accessibility** - Keyboard shortcuts, proper contrast, screen reader support

### 📊 **Comprehensive Tracking**
- **Real-time Statistics** - Current progress, accuracy rate, correct/wrong counts
- **Visual Progress Bar** - Animated progress indicator with shimmer effects
- **Session Management** - Resume exactly where you left off
- **Performance Analytics** - Track learning efficiency over time

## 🚀 Quick Start

### Option 1: Direct Use
visit the live demo at : https://hhhpraise.github.io/hsk-quiz/

### Option 2: Local Development
```bash
# Clone the repository
git clone https://github.com/hhhpraise/hsk-quiz.git

# Navigate to directory
cd hsk-quiz

# Open in browser
open index.html
# or
python -m http.server 8000  # For local server
```

### Option 3: GitHub Pages
Visit the live demo: `https://hhhpraise.github.io/hsk-quiz`

## 📱 Mobile Installation

### iOS Safari
1. Open the quiz in Safari
2. Tap the **Share** button
3. Select **"Add to Home Screen"**
4. Enjoy the app-like experience!

### Android Chrome
1. Open the quiz in Chrome
2. Tap the **Menu** (⋮)
3. Select **"Add to Home screen"**
4. Launch from your home screen

## 🎓 How to Use

### Basic Quiz Flow
1. **Select batch size** (25, 50, 100, or all words)
2. **Choose quiz mode** (Pinyin + English or English only)
3. **Read the Chinese character** displayed
4. **Tap the correct translation** from 4 options
5. **Get instant feedback** and move to next question

### Advanced Features
- **🔀 Shuffle** - Randomize current batch order
- **📚 Review** - Practice only your wrong answers
- **🔄 Reset** - Start over with fresh progress
- **⚡ Keyboard Shortcuts** - Use keys 1-4 to select options

### Smart Study Tips
- **Use Review Mode** - Focus on weak areas with wrong answer practice
- **Switch Modes** - Alternate between Pinyin and English-only for comprehensive learning
- **Batch Progression** - Complete smaller batches before tackling larger sets
- **Dark Mode** - Reduce eye strain during extended study sessions

## 🔧 Technical Details

### Built With
- **Vanilla JavaScript** - No frameworks, fast loading
- **Modern CSS** - CSS Grid, Flexbox, CSS Variables for theming
- **Progressive Enhancement** - Works on all devices and browsers
- **Local Storage API** - Persistent progress without server requirements

### Browser Compatibility
- ✅ **Chrome/Edge** 88+
- ✅ **Firefox** 85+
- ✅ **Safari** 14+
- ✅ **Mobile Browsers** - iOS Safari, Chrome Mobile, Samsung Internet

### Performance
- **Lightweight** - Single HTML file under 50KB
- **Fast Loading** - No external dependencies
- **Smooth Animations** - Hardware-accelerated CSS transitions
- **Battery Efficient** - Optimized for mobile devices

## 🎯 HSK 4 Vocabulary Coverage

The quiz includes carefully selected HSK Level 4 vocabulary with:
- **600 Essential Words** - Complete HSK 4 word list
- **Accurate Pinyin** - Proper tone marks and pronunciation
- **Contextual Translations** - Real-world English meanings
- **Smart Grouping** - Thematically organized batches

### Sample Categories
- **Family & Relationships** - 爱情, 父母, 结婚
- **Work & Education** - 工作, 学习, 毕业
- **Daily Life** - 生活, 购物, 旅游
- **Abstract Concepts** - 想法, 感情, 文化

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Adding Vocabulary
1. **Fork** the repository
2. **Edit** the `originalWords` array in the JavaScript section
3. **Follow the format**: `{ chinese: "字", pinyin: "zì", english: "word" }`
4. **Submit** a pull request

### Improving Features
- 🐛 **Bug fixes** - Report issues or submit fixes
- 🎨 **UI improvements** - Enhance the design or usability
- ⚡ **Performance** - Optimize loading or animations
- 🌐 **Translations** - Add interface translations for other languages

### Development Setup
```bash
# Fork and clone
git clone https://github.com/hhhpraise/hsk-quiz.git

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test
open index.html  # Test in browser

# Commit and push
git commit -m "Add your feature description"
git push origin feature/your-feature-name

# Create pull request
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ **Use commercially**
- ✅ **Modify and distribute**
- ✅ **Private use**
- ❗ **Include license notice**

## 🙏 Acknowledgments

- **HSK Official** - Vocabulary standards and structure
- **Chinese Language Community** - Feedback and testing
- **Open Source Contributors** - Code improvements and features
- **Mobile-First Design Principles** - Responsive design inspiration

## 📞 Support & Feedback

### 🐛 Found a Bug?
- **Open an issue** on GitHub with detailed steps to reproduce
- **Include browser/device info** for faster debugging

### 💡 Feature Request?
- **Check existing issues** first to avoid duplicates
- **Describe the use case** and expected behavior
- **Consider contributing** if you can implement it!

### ❓ Need Help?
- **Check the documentation** above
- **Browse existing issues** for similar questions
- **Open a discussion** for general questions

## 🚀 Roadmap

### Upcoming Features
- [ ] **Audio Pronunciation** - Native speaker recordings
- [ ] **Spaced Repetition** - Smart review scheduling
- [ ] **Study Streaks** - Gamification elements
- [ ] **Export Progress** - Data backup and sharing
- [ ] **Offline Mode** - Full offline functionality
- [ ] **Custom Word Lists** - User-defined vocabulary sets

### Long-term Goals
- [ ] **Multiple HSK Levels** - HSK 1-6 support
- [ ] **Character Writing** - Stroke order practice
- [ ] **Grammar Integration** - Sentence structure quizzes
- [ ] **Community Features** - Shared progress and competitions

---

## 🌟 Star History

If this project helped you learn Chinese, please consider giving it a ⭐ star!

[![Star History Chart](https://api.star-history.com/svg?repos=hhhpraise/hsk4-quiz&type=Date)](https://github.com/hhhpraise/hsk-quiz/stargazers)

---

<div align="center">

**Made with ❤️ for Chinese language learners worldwide**

[🌐 Live Demo](https://hhhpraise.github.io/hsk-quiz) • [📱 Mobile App](https://hhhpraise.github.io/hsk-quiz) • [🐛 Report Bug](https://github.com/hhhpraise/hsk-quiz/issues) • [💡 Request Feature](https://github.com/hhhpraise/hsk-quiz/issues)

</div>