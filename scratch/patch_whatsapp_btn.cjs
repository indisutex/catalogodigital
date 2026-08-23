const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

console.log('Original length:', content.length);

// 1. Add MessageCircle to imports if not present
const oldImport = `import { X, Upload, Package, Tag, Settings, LayoutDashboard, Plus, Trash2, Pencil, Check, Eye, EyeOff, Phone, LogOut, User, ShoppingBag, Copy, RefreshCw, Search, Calculator, Code, Menu, Users, Home, Lightbulb, Bell, CreditCard, Download, Building2, Trophy, MessageSquare, Link, PackageCheck, ArrowRightLeft, BarChart2, Palette, Printer, Code2, ChevronDown, ChevronRight, Wrench, ArrowUpDown, Filter, MapPin, XCircle, Truck, Clock, FileCheck, CheckCircle, Landmark, BookOpen, LifeBuoy, ShoppingCart, ClipboardList, Star, Ban, ExternalLink, Flame, RotateCcw } from 'lucide-react';`;

const newImport = `import { X, Upload, Package, Tag, Settings, LayoutDashboard, Plus, Trash2, Pencil, Check, Eye, EyeOff, Phone, LogOut, User, ShoppingBag, Copy, RefreshCw, Search, Calculator, Code, Menu, Users, Home, Lightbulb, Bell, CreditCard, Download, Building2, Trophy, MessageSquare, MessageCircle, Link, PackageCheck, ArrowRightLeft, BarChart2, Palette, Printer, Code2, ChevronDown, ChevronRight, Wrench, ArrowUpDown, Filter, MapPin, XCircle, Truck, Clock, FileCheck, CheckCircle, Landmark, BookOpen, LifeBuoy, ShoppingCart, ClipboardList, Star, Ban, ExternalLink, Flame, RotateCcw } from 'lucide-react';`;

if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log('1. Added MessageCircle to imports');
}

const normalize = (s) => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

// 2. Replace the chat button with a WhatsApp button
const oldBtn = `          {telefonoCliente && (
            <button 
              type="button" 
              onClick={() => {
                const cleanPhone = telefonoCliente.replace(/\\D/g, '');
                const target = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                window.open(formatWhatsAppLink(target), '_blank');
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1.5px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#475569',
                flexShrink: 0
              }}
              title="Abrir Chat WhatsApp"
            >
              <MessageSquare size={16} />
            </button>
          )}`;

const newBtn = `          {telefonoCliente && (
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                const cleanPhone = telefonoCliente.replace(/\\D/g, '');
                const target = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                window.open(formatWhatsAppLink(target), '_blank');
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: 'none',
                background: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ffffff',
                flexShrink: 0,
                transition: 'all 0.2s',
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.35)'
              }}
              title="Abrir WhatsApp del cliente"
            >
              <MessageCircle size={18} fill="#ffffff" color="#25D366" />
            </button>
          )}`;

if (normContent.includes(normalize(oldBtn))) {
  normContent = normContent.replace(normalize(oldBtn), normalize(newBtn));
  console.log('2. Replaced chat button with WhatsApp button');
} else {
  console.error('Failed 2. Replaced chat button');
}

fs.writeFileSync(adminPath, normContent, 'utf8');
console.log('Admin.tsx updated successfully! New length:', normContent.length);
