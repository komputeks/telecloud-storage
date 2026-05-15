'use client';

import { useState } from 'react';
import { AuthModal } from './AuthModal';
import {
  Cloud, Upload, Shield, Zap, Globe, Code, ChevronRight,
  Check, ArrowRight, Github, Terminal, Database, Lock
} from 'lucide-react';

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);

  const features = [
    {
      icon: Cloud,
      title: 'Unlimited Storage',
      description: 'Store unlimited files using Telegram as your backend. No storage limits, no hidden fees.',
    },
    {
      icon: Code,
      title: 'S3-Compatible API',
      description: 'Use your existing S3 tools and SDKs. Just change the endpoint URL.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'End-to-end encryption. Your files are stored securely on Telegram servers.',
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Global CDN delivery. Files are served from the nearest Telegram server.',
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
              <a href="#api" className="hidden md:block text-gray-400 hover:text-white transition-colors">
                API
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
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
            Free & Open Source
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Unlimited Cloud Storage
            <br />
            <span className="bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#22d3ee] bg-clip-text text-transparent">
              Powered by Telegram
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Store unlimited files with an S3-compatible API. Use your existing tools, 
            pay nothing, and enjoy global CDN delivery.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all text-lg"
            >
              Start Storing Free
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
              <p className="text-3xl font-bold text-white">∞</p>
              <p className="text-gray-500 text-sm">Storage</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">50MB</p>
              <p className="text-gray-500 text-sm">Max File Size</p>
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
              A complete cloud storage solution with all the features you expect, 
              without the enterprise price tag.
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

      {/* API Section */}
      <section id="api" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-4">
                S3-Compatible API
              </h2>
              <p className="text-gray-400 text-lg mb-6">
                Use your existing S3 tools and SDKs. Just change the endpoint URL 
                and you're ready to go. Works with rclone, AWS CLI, and more.
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
      <section className="py-20 px-4 bg-[#111118]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-gray-400 text-lg">
              Get started in less than 2 minutes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Create Account',
                description: 'Sign up for free with just your email. No credit card required.',
                icon: Lock,
              },
              {
                step: '02',
                title: 'Configure Storage',
                description: 'Connect your Telegram bot or use default settings for unlimited storage.',
                icon: Database,
              },
              {
                step: '03',
                title: 'Start Uploading',
                description: 'Use our web UI or S3 API to upload and manage files.',
                icon: Upload,
              },
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
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Join thousands of users who are already storing their files for free.
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
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
