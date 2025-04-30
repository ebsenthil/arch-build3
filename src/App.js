import React, { useState, useEffect } from 'react';
import { Amplify, API, Auth } from 'aws-amplify';
import {
  Container, TextField, Button, Typography, Box, Paper, Grid, 
  CircularProgress, Tabs, Tab, Divider, Snackbar, Alert,
  List, ListItem, ListItemText, IconButton, Accordion, AccordionSummary,
  AccordionDetails, Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import DescriptionIcon from '@mui/icons-material/Description';
import SaveIcon from '@mui/icons-material/Save';
import ReactMarkdown from 'react-markdown';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import awsExports from './aws-exports';

// Configure Amplify
Amplify.configure(awsExports);

// Create theme with corporate colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#0066b2',
    },
    secondary: {
      main: '#6c757d',
    },
    background: {
      default: '#f8f9fa',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
});

// Document sections configuration
const documentSections = [
  { id: 'introduction', title: '1. Introduction', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'scope', title: '2. Scope', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'requirements', title: '3. Requirements', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'system_context_diagram', title: '4. System Context Diagram', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'component_model', title: '5. Component Model', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'physical_operational_model', title: '6. Physical Operational Model', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'architectural_decisions', title: '7. Architectural Decisions', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'viability_assessment', title: '8. Viability Assessment', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'appendix', title: '9. Appendix', icon: <DescriptionIcon fontSize="small" /> },
];

// Available Bedrock models
const bedrockModels = [
  { id: 'meta.llama3-2-90b-instruct-v1:0', name: 'Llama 3.2 90B Instruct' },
  { id: 'meta.llama3-8b-instruct-v1:0', name: 'Llama 3 8B Instruct' },
  { id: 'anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet' },
  { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku' },
  { id: 'amazon.titan-text-express-v1', name: 'Amazon Titan Text Express' },
];

function App() {
  // State variables
  const [projectDetails, setProjectDetails] = useState({
    projectName: '',
    projectDescription: '',
    requirements: '',
    cloudProvider: 'AWS',
  });
  
  const [knowledgeBaseId, setKnowledgeBaseId] = useState('');
  const [modelId, setModelId] = useState('meta.llama3-2-90b-instruct-v1:0');
  const [loading, setLoading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [activeSection, setActiveSection] = useState('introduction');
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [savedProjects, setSavedProjects] = useState([]);
  
  // Effects
  useEffect(() => {
    // Load the knowledge base ID from environment or configuration
    const kbId = process.env.REACT_APP_KNOWLEDGE_BASE_ID || '';
    setKnowledgeBaseId(kbId);
    
    // Load any saved projects from local storage
    const saved = localStorage.getItem('savedProjects');
    if (saved) {
      try {
        setSavedProjects(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved projects', e);
      }
    }
  }, []);
  
  // Event handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProjectDetails({
      ...projectDetails,
      [name]: value,
    });
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  const handleSectionChange = (section) => {
    setActiveSection(section);
  };
  
  const handleModelChange = (e) => {
    setModelId(e.target.value);
  };
  
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  const showNotification = (message, severity = 'info') => {
    setNotification({
      open: true,
      message,
      severity,
    });
  };
  
  const validateForm = () => {
    if (!projectDetails.projectName.trim()) {
      showNotification('Project name is required', 'error');
      return false;
    }
    if (!projectDetails.projectDescription.trim()) {
      showNotification('Project description is required', 'error');
      return false;
    }
    if (!projectDetails.requirements.trim()) {
      showNotification('Requirements are required', 'error');
      return false;
    }
    if (!knowledgeBaseId) {
      showNotification('Knowledge Base ID is not configured. The document may lack context from reference documents.', 'warning');
      // Continue anyway but with warning
    }
    return true;
  };
  
  const generatePreview = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const response = await API.post('ArchDocGenApi', '/generate-document', {
        body: {
          projectDetails,
          knowledgeBaseId,
          modelId,
          action: 'preview'
        }
      });
      
      if (response.content) {
        setDocumentPreview(response.content);
        setActiveTab(1); // Switch to preview tab
        showNotification('Document preview generated successfully!', 'success');
      } else {
        showNotification('Failed to generate preview: Empty response', 'error');
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      showNotification(`Failed to generate preview: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const generateDocument = async () => {
    if (!documentPreview) {
      showNotification('Please generate a preview first', 'warning');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await API.post('ArchDocGenApi', '/generate-document', {
        body: {
          projectDetails,
          knowledgeBaseId,
          modelId,
          action: 'generate'
        }
      });
      
      if (response.document && response.filename) {
        // Convert base64 to blob
        const byteCharacters = atob(response.document);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        
        // Create download link and trigger it
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Document generated and downloaded successfully!', 'success');
      } else {
        showNotification('Failed to generate document: Invalid response', 'error');
      }
    } catch (error) {
      console.error('Error generating document:', error);
      showNotification(`Failed to generate document: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const saveProject = () => {
    if (!projectDetails.projectName) {
      showNotification('Project name is required to save', 'warning');
      return;
    }
    
    const newProject = {
      id: Date.now().toString(),
      name: projectDetails.projectName,
      date: new Date().toLocaleDateString(),
      details: { ...projectDetails }
    };
    
    const updatedProjects = [...savedProjects, newProject];
    setSavedProjects(updatedProjects);
    localStorage.setItem('savedProjects', JSON.stringify(updatedProjects));
    
    showNotification('Project saved successfully!', 'success');
  };
  
  const loadProject = (project) => {
    setProjectDetails(project.details);
    setDocumentPreview(null); // Clear any existing preview
    setActiveTab(0); // Switch to input tab
    showNotification(`Project "${project.name}" loaded successfully`, 'info');
  };
  
  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Typography variant="h4" gutterBottom align="center" color="primary">
            AI-Assisted Architecture Document Generator
          </Typography>
          <Typography variant="subtitle1" align="center" color="text.secondary" gutterBottom>
            Create comprehensive architecture documents powered by Bedrock AI models
          </Typography>
          <Divider sx={{ my: 2 }} />
          
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            variant="fullWidth" 
            sx={{ mb: 3 }}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab icon={<DescriptionIcon />} label="Project Details" />
            <Tab 
              icon={<PreviewIcon />} 
              label="Document Preview" 
              disabled={!documentPreview} 
            />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={9}>
                <Paper elevation={1} sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Project Information
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Project Name"
                        name="projectName"
                        value={projectDetails.projectName}
                        onChange={handleInputChange}
                        required
                        variant="outlined"
                        margin="normal"
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth margin="normal">
                        <InputLabel id="cloud-provider-label">Cloud Provider</InputLabel>
                        <Select
                          labelId="cloud-provider-label"
                          id="cloud-provider"
                          name="cloudProvider"
                          value={projectDetails.cloudProvider}
                          label="Cloud Provider"
                          onChange={handleInputChange}
                        >
                          <MenuItem value="AWS">AWS</MenuItem>
                          <MenuItem value="Azure">Azure</MenuItem>
                          <MenuItem value="GCP">Google Cloud</MenuItem>
                          <MenuItem value="Hybrid">Hybrid Cloud</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Project Description"
                        name="projectDescription"
                        value={projectDetails.projectDescription}
                        onChange={handleInputChange}
                        required
                        multiline
                        rows={4}
                        variant="outlined"
                        margin="normal"
                        placeholder="Provide a detailed description of the project, including its purpose, goals, and business context."
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Requirements"
                        name="requirements"
                        value={projectDetails.requirements}
                        onChange={handleInputChange}
                        required
                        multiline
                        rows={6}
                        variant="outlined"
                        margin="normal"
                        placeholder="List both functional and non-functional requirements for the project. Be specific about performance, security, scalability, and compliance needs."
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <FormControl fullWidth margin="normal">
                        <InputLabel id="model-select-label">AI Model</InputLabel>
                        <Select
                          labelId="model-select-label"
                          id="model-select"
                          value={modelId}
                          label="AI Model"
                          onChange={handleModelChange}
                        >
                          {bedrockModels.map((model) => (
                            <MenuItem key={model.id} value={model.id}>
                              {model.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        size="large"
                        onClick={generatePreview}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : <PreviewIcon />}
                        sx={{ mt: 2, py: 1.5 }}
                      >
                        {loading ? 'Generating...' : 'Generate Document Preview'}
                      </Button>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Button
                        variant="outlined"
                        color="primary"
                        fullWidth
                        size="large"
                        onClick={saveProject}
                        startIcon={<SaveIcon />}
                        sx={{ mt: 2, py: 1.5 }}
                      >
                        Save Project
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Paper elevation={1} sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Saved Projects
                  </Typography>
                  
                  {savedProjects.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      No saved projects yet. Fill out the project details and click "Save Project" to save your work.
                    </Typography>
                  ) : (
                    <List dense>
                      {savedProjects.map((project) => (
                        <ListItem 
                          key={project.id}
                          secondaryAction={
                            <IconButton edge="end" onClick={() => loadProject(project)}>
                              <DescriptionIcon fontSize="small" />
                            </IconButton>
                          }
                          sx={{ 
                            border: '1px solid #e0e0e0', 
                            borderRadius: 1, 
                            mb: 1,
                            '&:hover': { bgcolor: '#f5f5f5' } 
                          }}
                        >
                          <ListItemText 
                            primary={project.name} 
                            secondary={`Saved on ${project.date}`} 
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && documentPreview && (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
              <Box 
                sx={{ 
                  width: { xs: '100%', md: '25%' }, 
                  pr: { md: 2 }, 
                  mb: { xs: 2, md: 0 } 
                }}
              >
                <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Document Sections
                  </Typography>
                  
                  <List dense sx={{ bgcolor: 'background.paper' }}>
                    {documentSections.map((section) => (
                      <ListItem 
                        button 
                        key={section.id}
                        selected={activeSection === section.id}
                        onClick={() => handleSectionChange(section.id)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          bgcolor: activeSection === section.id ? 'rgba(0, 102, 178, 0.1)' : 'transparent',
                          '&:hover': { bgcolor: 'rgba(0, 102, 178, 0.05)' }
                        }}
                      >
                        <ListItemText 
                          primary={
                            <Typography variant="body2" fontWeight={activeSection === section.id ? 600 : 400}>
                              {section.title}
                            </Typography>
                          } 
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={<DownloadIcon />}
                    onClick={generateDocument}
                    disabled={loading}
                    sx={{ mt: 2 }}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Download as Word'}
                  </Button>
                </Paper>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '75%' } }}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom color="primary">
                    {documentPreview[activeSection]?.title || 'Section Not Available'}
                  </Typography>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  {documentPreview[activeSection]?.content ? (
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: '#fafafa', 
                      borderRadius: 1,
                      border: '1px solid #e0e0e0',
                      minHeight: '500px',
                      maxHeight: '700px',
                      overflow: 'auto'
                    }}>
                      <ReactMarkdown>
                        {documentPreview[activeSection].content}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <Box sx={{ 
                      p: 4, 
                      bgcolor: '#fafafa',
                      borderRadius: 1, 
                      textAlign: 'center'
                    }}>
                      <Typography color="text.secondary">
                        This section has no content.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Box>
            </Box>
          )}
        </Paper>
        
        <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: '#f5f7fa', borderRadius: 2 }}>
          <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">About This Application</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary">
                This application generates comprehensive architecture documents using AWS Bedrock AI models
                and knowledge bases. The document follows enterprise architecture standards and includes
                detailed sections covering scope, requirements, system context, component model, physical 
                operational model, architectural decisions, and viability assessment.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Currently using <strong>{bedrockModels.find(m => m.id === modelId)?.name || modelId}</strong> to generate content.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Paper>
        
        <Snackbar 
          open={notification.open} 
          autoHideDuration={6000} 
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity} 
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
}

export default App;
