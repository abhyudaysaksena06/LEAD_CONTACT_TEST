import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { ArrowRight, CheckCircle, Send } from 'lucide-react';
import useMouseParallax from '../../hooks/useMouseParallax';
import './ContactForm.css';
// Reusable 3D Glass Input Field
function GlassInputField({ label, type = 'text', name, value, onChange, placeholder, required }) {
  const containerRef = useRef(null);
  const { rotate, reflect, isHovered } = useMouseParallax(containerRef, { maxRotation: 3 });

  const style = {
    '--input-rot-x': `${rotate.x}deg`,
    '--input-rot-y': `${rotate.y}deg`,
    '--input-reflect-x': `${reflect.x}%`,
    '--input-reflect-y': `${reflect.y}%`,
  };

  return (
    <div 
      ref={containerRef}
      className={`glass-input-wrapper ${isHovered ? 'hovered' : ''}`}
      style={style}
      onClick={(e) => {
      e.currentTarget.querySelector("input, textarea")?.focus();
  }} >
      <div className="input-reflection" />
      <label className="input-label" style={{ paddingLeft: '16px' }}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="glass-input-field"
        style={{ paddingLeft: '16px' }}
      />
      <div className="input-glow-border" />
    </div>
  );
}
// Reusable 3D Glass Textarea
function GlassTextAreaField({ label, name, value, onChange, placeholder, required, rows = 5 }) {
  const containerRef = useRef(null);
  const { rotate, reflect, isHovered } = useMouseParallax(containerRef, { maxRotation: 2.5 });

  const style = {
    '--input-rot-x': `${rotate.x}deg`,
    '--input-rot-y': `${rotate.y}deg`,
    '--input-reflect-x': `${reflect.x}%`,
    '--input-reflect-y': `${reflect.y}%`,
  };

  return (
    <div 
      ref={containerRef}
      className={`glass-input-wrapper textarea-wrapper ${isHovered ? 'hovered' : ''}`}
      style={style}
    >
      <div className="input-reflection" />
      <label className="input-label" style={{ paddingLeft: '16px' }}>{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="glass-input-field glass-textarea-field"
        style={{ paddingLeft: '16px' }}
      />
      <div className="input-glow-border" />
    </div>
  );
}

export default function ContactForm() {
  const form = useRef();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const buttonRef = useRef(null);
  const { rotate: btnRot, reflect: btnReflect } = useMouseParallax(buttonRef, { maxRotation: 4 });

  const btnStyle = {
    '--btn-rot-x': `${btnRot.x}deg`,
    '--btn-rot-y': `${btnRot.y}deg`,
    '--btn-reflect-x': `${btnReflect.x}%`,
    '--btn-reflect-y': `${btnReflect.y}%`,
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const handleSubmit = (e) => {
  e.preventDefault();

  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  // Guard: missing configuration is the most common cause of failed sends.
  const missing = [
    !serviceId && 'VITE_EMAILJS_SERVICE_ID',
    !templateId && 'VITE_EMAILJS_TEMPLATE_ID',
    !publicKey && 'VITE_EMAILJS_PUBLIC_KEY',
  ].filter(Boolean);
  if (missing.length) {
    console.error('EmailJS config missing:', missing.join(', '));
    alert(`Email is not configured. Missing: ${missing.join(', ')}. Add these to your .env file and restart the dev server.`);
    return;
  }

  setIsSubmitting(true);
  emailjs.sendForm(serviceId, templateId, form.current, { publicKey })
  .then(() => {
    setIsSubmitting(false);
    setIsSuccess(true);

    setFormData({
      name: '',
      email: '',
      subject: '',
      message: '',
    });
    setTimeout(() => {
      setIsSuccess(false);
    }, 5000);
  })
  .catch((error) => {
    console.error("EmailJS Error:", error);
    setIsSubmitting(false);
    const detail = error?.text || error?.message || 'Unknown error';
    const status = error?.status ? ` (status ${error.status})` : '';
    alert(`Failed to send message${status}: ${detail}`);
  });
};
  return (
    <div className="contact-form-container">
      {isSuccess ? (
        <div className="success-glass-card">
          <CheckCircle className="success-icon" />
          <h3 className="success-title">Message Sent Successfully</h3>
          <p className="success-desc">
            Thank you for reaching out. The LEAD team will review your message and get back to you shortly.
          </p>
          <button onClick={() => setIsSuccess(false)} className="success-btn">
            Send Another Message
          </button>
        </div>
      ) : (
        <form 
         ref={form}
         onSubmit={handleSubmit} 
         className="contact-form"
        >
          <div className="form-row">
            <GlassInputField
              label="Your Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Aisha Kapoor"
              required
            />
            <GlassInputField
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>
          <GlassInputField
            label="What's this about?"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder="Joining / Sponsorship / Something else"
            required
          />
          <GlassTextAreaField
            label="Message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Tell us what you have in mind..."
            required
          />
          <button
            ref={buttonRef}
            type="submit"
            className={`submit-btn ${isSubmitting ? 'submitting' : ''}`}
            style={{ ...btnStyle, padding: '6px 24px' }}
            disabled={isSubmitting}
          >
            {/* Ambient glows and reflex inside button */}
            <div className="btn-reflection" />
            <div className="btn-shine" />
            
            <span className="btn-content">
              {isSubmitting ? (
                <>Sending Message...</>
              ) : (
                <>
                  Send Message
                  <ArrowRight className="btn-arrow" />
                </>
              )}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}
