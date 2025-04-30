import json
import os
import base64
import boto3
from datetime import datetime
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import io
import re

# Initialize AWS clients
bedrock_runtime = boto3.client('bedrock-runtime')
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

def lambda_handler(event, context):
    try:
        # Parse the incoming event
        body = json.loads(event.get('body', '{}'))
        
        # Extract parameters
        project_details = body.get('projectDetails', {})
        knowledge_base_id = body.get('knowledgeBaseId', os.environ.get('KNOWLEDGE_BASE_ID'))
        model_id = body.get('modelId', os.environ.get('BEDROCK_MODEL_ID', 'meta.llama3-2-90b-instruct-v1:0'))
        action = body.get('action', 'preview')  # 'preview' or 'generate'
        
        # Validate required inputs
        if not project_details:
            return build_response(400, {'message': 'Missing project details'})
        
        if not knowledge_base_id:
            return build_response(400, {'message': 'Missing knowledge base ID'})
            
        # Generate architecture document content
        doc_content = generate_document_content(project_details, knowledge_base_id, model_id)
        
        if action == 'preview':
            # Return the generated content for preview
            return build_response(200, {'content': doc_content})
        elif action == 'generate':
            # Create Word document
            doc_binary = create_word_document(doc_content, project_details)
            
            # Encode the document as base64 to send it back to the client
            encoded_doc = base64.b64encode(doc_binary).decode('utf-8')
            
            return build_response(200, {
                'document': encoded_doc,
                'filename': f"Architecture_Document_{project_details.get('projectName', 'Project')}_{datetime.now().strftime('%Y%m%d')}.docx"
            })
        else:
            return build_response(400, {'message': 'Invalid action. Use "preview" or "generate"'})
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {'message': f'Error processing request: {str(e)}'})

def generate_document_content(project_details, knowledge_base_id, model_id):
    """Generate the architecture document content sections using Bedrock model and knowledge base"""
    
    document = {}
    
    # Sections to generate
    sections = [
        {
            "name": "introduction",
            "title": "Introduction",
            "prompt": f"Generate an introduction section for an architecture document for the project named '{project_details.get('projectName')}'. The introduction should provide an overview of the project, its purpose, and key objectives. It should be professional, clear, and concise."
        },
        {
            "name": "scope",
            "title": "Scope",
            "prompt": f"For the project '{project_details.get('projectName')}', generate the Scope section with two subsections: 'In Scope' and 'Out of Scope'. List items in bullet points. Base this on the project description: '{project_details.get('projectDescription')}' and requirements: '{project_details.get('requirements')}'."
        },
        {
            "name": "requirements",
            "title": "Requirements",
            "prompt": f"Generate the Requirements section for the project '{project_details.get('projectName')}' with two subsections: 'Functional Requirements' and 'Non-functional Requirements'. For each requirement, include an ID (e.g., FR-01, NFR-01), a title, and a description. Base this on the project requirements: '{project_details.get('requirements')}' and any best practices for similar systems."
        },
        {
            "name": "system_context_diagram",
            "title": "System Context Diagram",
            "prompt": f"For the project '{project_details.get('projectName')}', describe a system context diagram. Include: 1) A textual description of what should be in the diagram showing the system and its interactions with external actors/systems. 2) A table listing all actors/external services and their functions/interactions with the system. Base this on the project description: '{project_details.get('projectDescription')}' and requirements: '{project_details.get('requirements')}'."
        },
        {
            "name": "component_model",
            "title": "Component Model",
            "prompt": f"For the project '{project_details.get('projectName')}', describe the component model. Include: 1) A textual description of what should be in the component diagram showing the main components of the system and their relationships. 2) A description of each component, its responsibility, and how it interacts with other components. Base this on the project description: '{project_details.get('projectDescription')}' and requirements: '{project_details.get('requirements')}'."
        },
        {
            "name": "physical_operational_model",
            "title": "Physical Operational Model",
            "prompt": f"For the project '{project_details.get('projectName')}', describe the physical operational model. Include: 1) A textual description of what should be in the infrastructure diagram showing the physical deployment of the system components across infrastructure. 2) A description of each infrastructure component, including AWS services to be used, regions, high availability considerations, etc. Base this on the project description: '{project_details.get('projectDescription')}' and requirements: '{project_details.get('requirements')}'."
        },
        {
            "name": "architectural_decisions",
            "title": "Architectural Decisions",
            "prompt": f"For the project '{project_details.get('projectName')}', generate a table of architectural decisions. Each decision should include: Decision ID, Decision Title, Context, Options Considered, Decision, Justification, and Implications. Include at least 5 key architectural decisions related to the technology stack, deployment strategy, security approach, scalability, and integration patterns. Base this on the project description: '{project_details.get('projectDescription')}' and requirements: '{project_details.get('requirements')}'."
        },
        {
            "name": "viability_assessment",
            "title": "Viability Assessment",
            "prompt": f"For the project '{project_details.get('projectName')}', generate a viability assessment with four tables: 1) Risks - with columns for Risk ID, Description, Impact (High/Medium/Low), Probability (High/Medium/Low), and Mitigation Strategy; 2) Assumptions - with columns for Assumption ID, Description, and Impact; 3) Issues - with columns for Issue ID, Description, Impact, and Resolution Path; 4) Dependencies - with columns for Dependency ID, Description, Type (External/Internal), and Management Strategy. Base this on the project description: '{project_details.get('projectDescription')}' and requirements: '{project_details.get('requirements')}'."
        },
        {
            "name": "appendix",
            "title": "Appendix",
            "prompt": f"Generate an appendix section for the architecture document for project '{project_details.get('projectName')}'. Include: 1) A glossary of key terms used in the document; 2) References to any standards, frameworks, or resources used; 3) Any additional information that might be useful but doesn't fit in the main document sections."
        }
    ]
    
    # Generate content for each section using knowledge base
    for section in sections:
        print(f"Generating section: {section['name']}")
        content = generate_section_with_knowledge_base(
            knowledge_base_id, 
            model_id, 
            section['prompt'],
            project_details
        )
        document[section['name']] = {
            'title': section['title'],
            'content': content
        }
    
    return document

def generate_section_with_knowledge_base(knowledge_base_id, model_id, prompt, project_details):
    """Generate a section of the document using Bedrock knowledge base and model"""
    
    try:
        # First, query the knowledge base to get relevant information
        kb_response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=knowledge_base_id,
            retrievalQuery={
                'text': f"{prompt} {project_details.get('projectDescription', '')} {project_details.get('requirements', '')}"
            },
            numberOfResults=5
        )
        
        # Extract retrieved passages
        retrieved_info = ""
        for result in kb_response.get('retrievalResults', []):
            retrieved_info += f"{result.get('content', {}).get('text', '')}\n\n"
        
        # Enhance the prompt with retrieved information
        enhanced_prompt = f"""
        Task: Generate a section for an architecture document based on the provided information.
        
        Original Prompt: {prompt}
        
        Relevant information from knowledge base:
        {retrieved_info}
        
        Project Details:
        Project Name: {project_details.get('projectName', 'Not provided')}
        Project Description: {project_details.get('projectDescription', 'Not provided')}
        Requirements: {project_details.get('requirements', 'Not provided')}
        
        Generate a professional, well-structured response that could be directly included in the architecture document.
        Format the output appropriately with proper headings, lists, and tables as needed.
        """
        
        # Call Bedrock model to generate the content
        # Prepare the request body based on model type
        if "meta.llama" in model_id.lower():
            # Llama model format
            request_body = json.dumps({
                "prompt": enhanced_prompt,
                "max_gen_len": 4000,
                "temperature": 0.5,
                "top_p": 0.9
            })
        else:
            # Default to Claude/Anthropic format
            request_body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4000,
                "messages": [
                    {
                        "role": "user",
                        "content": enhanced_prompt
                    }
                ]
            })
        
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=request_body
        )
        
        response_body = json.loads(response.get('body').read())
        
        # Extract generated text based on model type
        if "meta.llama" in model_id.lower():
            generated_text = response_body.get('generation', '')
        else:
            generated_text = response_body.get('content', [{}])[0].get('text', '')
        
        return generated_text
    
    except Exception as e:
        print(f"Error generating section with knowledge base: {str(e)}")
        # Return a placeholder if there's an error
        return f"Error generating content: {str(e)}"

def create_word_document(doc_content, project_details):
    """Create a Word document with the generated content"""
    
    doc = Document()
    
    # Set document properties
    doc.core_properties.title = f"Architecture Document - {project_details.get('projectName', 'Project')}"
    doc.core_properties.author = "Generated with AWS Bedrock"
    
    # Add title page
    title_paragraph = doc.add_paragraph()
    title_run = title_paragraph.add_run(f"Architecture Document\n{project_details.get('projectName', 'Project')}")
    title_run.font.size = Pt(24)
    title_run.font.bold = True
    title_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Add date
    date_paragraph = doc.add_paragraph()
    date_run = date_paragraph.add_run(f"Date: {datetime.now().strftime('%B %d, %Y')}")
    date_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Add page break after title page
    doc.add_page_break()
    
    # Add table of contents placeholder
    doc.add_heading("Table of Contents", level=1)
    doc.add_paragraph("(Table of contents will be generated when opening the document in Word)")
    doc.add_page_break()
    
    # Add each section
    section_order = [
        ("introduction", "Introduction"),
        ("scope", "Scope"),
        ("requirements", "Requirements"),
        ("system_context_diagram", "System Context Diagram"),
        ("component_model", "Component Model"),
        ("physical_operational_model", "Physical Operational Model"),
        ("architectural_decisions", "Architectural Decisions"),
        ("viability_assessment", "Viability Assessment"),
        ("appendix", "Appendix")
    ]
    
    for section_key, section_title in section_order:
        section_data = doc_content.get(section_key, {})
        if section_data:
            # Add section heading
            doc.add_heading(section_data.get('title', section_title), level=1)
            
            # Add section content
            content = section_data.get('content', '')
            
            # Parse markdown-like content to Word
            process_content_to_word(doc, content)
            
            # Add page break between sections
            doc.add_page_break()
    
    # Save the document to a bytes buffer
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    
    return buffer.getvalue()

def process_content_to_word(doc, content):
    """Process markdown-like content into Word document format"""
    
    # Split content by lines
    lines = content.split('\n')
    current_list = None
    table_data = []
    in_table = False
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip empty lines
        if not line:
            i += 1
            continue
        
        # Handle headers (## Header)
        if line.startswith('#'):
            level = len(re.match(r'^#+', line).group())
            header_text = line[level:].strip()
            doc.add_heading(header_text, level=min(level, 9))
            current_list = None
        
        # Handle list items
        elif line.startswith('- ') or line.startswith('* '):
            if current_list is None:
                current_list = doc.add_paragraph()
            item_text = line[2:].strip()
            item = current_list.add_run('• ' + item_text + '\n')
        
        # Handle numbered list
        elif re.match(r'^\d+\.', line):
            if current_list is None:
                current_list = doc.add_paragraph()
            item_text = re.sub(r'^\d+\.\s*', '', line)
            item = current_list.add_run(line + '\n')
        
        # Handle table rows with pipe separators
        elif '|' in line:
            if not in_table:
                in_table = True
                table_data = []
            
            # Skip separator lines (|----|-----|)
            if re.match(r'^[\|\-\s]+$', line):
                i += 1
                continue
                
            # Process table row
            cells = [cell.strip() for cell in line.split('|')]
            cells = [cell for cell in cells if cell]  # Remove empty cells
            table_data.append(cells)
        
        # End of table detection
        elif in_table and not '|' in line:
            # Create the table
            if table_data:
                rows = len(table_data)
                cols = max(len(row) for row in table_data)
                
                table = doc.add_table(rows=rows, cols=cols)
                table.style = 'Table Grid'
                
                # Fill the table
                for r, row in enumerate(table_data):
                    for c, cell in enumerate(row):
                        if c < cols:  # Ensure we don't exceed column count
                            table.cell(r, c).text = cell
                
                # Bold the header row
                for cell in table.rows[0].cells:
                    for paragraph in cell.paragraphs:
                        for run in paragraph.runs:
                            run.font.bold = True
                
                table_data = []
                in_table = False
                doc.add_paragraph()  # Add space after table
            
            # Process the current line (first line after table)
            continue  # Reprocess current line
        
        # Regular paragraph
        else:
            if not in_table:  # Don't add paragraphs inside table processing
                current_list = None
                doc.add_paragraph(line)
        
        i += 1
    
    # Handle the case where the document ends with a table
    if in_table and table_data:
        rows = len(table_data)
        cols = max(len(row) for row in table_data)
        
        table = doc.add_table(rows=rows, cols=cols)
        table.style = 'Table Grid'
        
        # Fill the table
        for r, row in enumerate(table_data):
            for c, cell in enumerate(row):
                if c < cols:  # Ensure we don't exceed column count
                    table.cell(r, c).text = cell
        
        # Bold the header row
        for cell in table.rows[0].cells:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.bold = True

def build_response(status_code, body):
    """Build the response object for API Gateway"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        'body': json.dumps(body)
    }
