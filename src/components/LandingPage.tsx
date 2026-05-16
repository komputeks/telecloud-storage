'use client';

import { useState } from 'react';
import { AuthModal } from './AuthModal';
import {
  Cloud, Upload, Shield, Zap, Globe, Code, ChevronRight,
  Check, ArrowRight, Github, Terminal, Database, Lock,
  CreditCard, Sparkles, Bot, HardDrive
} from 'lucide-react';

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);

  const features = [
    {
      icon: Cloud,
      title: '50MB Free Storage',
      description: 'Get started instantly with 50MB of free cloud storage. No credit card required.',
    },
    {
      icon: Sparkles,
      title: 'Unlimited with Upgrade',
      description: 'Upgrade your account, configure your own Telegram bot, and unlock unlimited storage.',
    },
    {
      icon: Code,
      title: 'S3-Compatible API',
      description: 'Use your existing S3 tools and SDKs. Just change the endpoint URL.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Files are stored securely on Telegram servers. Premium users get their own private bot.',
    },
    {
      icon: Globe,
      title: 'URL Upload',
      description: 'Upload files directly from URLs. No need to download first.',
    },
    {
      icon: Terminal,
      title: 'CLI Support',
      description: 'Use rclone, AWS CLI, or any S3-compatible tool to manage your files.',
    },
  ];

  const codeExample = `# Configure rclone
rclone config create telecloud s3 \\
  provider=Other \\
  endpoint=https://your-domain.com/api/s3 \\
  access_key_id=your-email \\
  secret_access_key=your-token

# Upload a file
rclone copy myfile.txt telecloud:my-bucket/

# List files
rclone ls telecloud:my-bucket/`;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">TeleCloud</span>
            </div>

            <div className="flex items-center gap-4">
              <a href="#features" className="hidden md:block text-gray-400 hover:text-white transition-colors">
                Features
              </a>
              <a href="#pricing" className="hidden md:block text-gray-400 hover:text-white transition-colors">
                Pricing
              </a>
              <a href="#api" className="hidden md:block text-gray-400 hover:text-white transition-colors">
                API
              </a>
              <a href="https://github.com/komputeks/telecloud-storage" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <button
                onClick={() => setShowAuth(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-medium rounded-xl transition-all"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#6366f1]/20 rounded-full text-[#6366f1] text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            50MB Free — Unlimited with Upgrade
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Cloud Storage
            <br />
            <span className="bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#22d3ee] bg-clip-text text-transparent">
              Powered by Telegram
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Start with 50MB free storage. Upgrade to unlock unlimited storage with your own 
            Telegram bot. S3-compatible API included.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all text-lg"
            >
              Start Free
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#api"
              className="flex items-center gap-2 px-8 py-4 bg-[#1e1e2e] hover:bg-[#27272a] text-white font-semibold rounded-xl transition-all text-lg"
            >
              <Terminal className="w-5 h-5" />
              View API Docs
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-16">
            <div>
              <p className="text-3xl font-bold text-white">50MB</p>
              <p className="text-gray-500 text-sm">Free Storage</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">∞</p>
              <p className="text-gray-500 text-sm">With Upgrade</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">99.9%</p>
              <p className="text-gray-500 text-sm">Uptime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-[#111118]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              A complete cloud storage solution with S3-compatible API, 
              web UI, and Telegram-powered backend.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 bg-[#111118] border border-[#27272a] rounded-2xl hover:border-[#6366f1] transition-all"
              >
                <div className="p-3 rounded-xl bg-[#6366f1]/20 w-fit mb-4">
                  <feature.icon className="w-6 h-6 text-[#6366f1]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Simple Pricing</h2>
            <p className="text-gray-400 text-lg">Start free, upgrade when you need more.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="p-8 bg-[#111118] border border-[#27272a] rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-gray-500/20">
                  <HardDrive className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Free</h3>
                  <p className="text-gray-500 text-sm">Get started instantly</p>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-gray-500">/forever</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  '50MB storage',
                  'Web UI file manager',
                  'Shared Telegram bot',
                  'S3-compatible API',
                  'API key access',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#22c55e]" />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowAuth(true)}
                className="w-full py-3 bg-[#1e1e2e] hover:bg-[#27272a] text-white font-semibold rounded-xl transition-all"
              >
                Sign Up Free
              </button>
            </div>

            {/* Premium Plan */}
            <div className="p-8 bg-gradient-to-b from-[#6366f1]/10 to-[#111118] border border-[#6366f1]/30 rounded-2xl relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-full text-xs font-bold text-white">
                RECOMMENDED
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-[#6366f1]/20">
                  <Sparkles className="w-6 h-6 text-[#6366f1]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Premium</h3>
                  <p className="text-gray-500 text-sm">Unlimited everything</p>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">TBD</span>
                <span className="text-gray-500"> via M-Pesa</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Unlimited storage',
                  'Your own private Telegram bot',
                  'Full S3 API access',
                  'Priority support',
                  'Custom integrations',
                  'Webhook support',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#6366f1]" />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
              <button
                className="w-full py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Coming Soon
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">M-Pesa integration in progress</p>
            </div>
          </div>
        </div>
      </section>

      {/* API Section */}
      <section id="api" className="py-20 px-4 bg-[#111118]/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-4">
                S3-Compatible API
              </h2>
              <p className="text-gray-400 text-lg mb-6">
                Use your existing S3 tools and SDKs. Just change the endpoint URL 
                and you&apos;re ready to go. Works with rclone, AWS CLI, and more.
              </p>

              <ul className="space-y-4">
                {[
                  'RESTful API with S3-compatible endpoints',
                  'Presigned URLs for secure file sharing',
                  'Bucket management and file operations',
                  'Works with rclone, AWS SDK, and more',
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-[#22c55e]/20">
                      <Check className="w-4 h-4 text-[#22c55e]" />
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#111118] border border-[#27272a] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#1e1e2e] border-b border-[#27272a]">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-sm text-gray-500">Terminal</span>
              </div>
              <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
                <code>{codeExample}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg">Get started in less than 2 minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create Account', description: 'Sign up for free with your email. Get 50MB storage instantly.', icon: Lock },
              { step: '02', title: 'Upload Files', description: 'Use our web UI or S3 API to upload and manage your files.', icon: Upload },
              { step: '03', title: 'Upgrade for More', description: 'Need more? Upgrade and connect your own Telegram bot for unlimited storage.', icon: Bot },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="text-6xl font-bold text-[#27272a] mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
                {index < 2 && (
                  <ChevronRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-[#27272a]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-[#111118]/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-gray-400 text-lg mb-8">
            Create your free account and start storing files in seconds.
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all text-lg"
          >
            Create Free Account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">TeleCloud</span>
          </div>

          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} TeleCloud. Open source under MIT license.
          </p>

          <div className="flex items-center gap-4">
            <a href="https://github.com/komputeks/telecloud-storage" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
