"""
Pattern 1 — RAG family using LangChain.

Mirrors backend/app/rag_service.py + rag_multistep.py.
Same features:
  - 500-token chunks with 50-token overlap
  - Per-course Chroma collection
  - Multi-step query decomposition (MultiQueryRetriever)
  - Cross-encoder reranking with BAAI/bge-reranker-v2-m3

How to run:
    cd langchain_integration
    python 01_rag_layered.py
"""

import os
from dotenv import load_dotenv

from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain.retrievers import ContextualCompressionRetriever
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

# ─── 1. Load and chunk documents (same 500/50 chunk sizes as your rag_service.py) ───
loader = TextLoader("data/db_lecture.txt", encoding="utf-8")
documents = loader.load()

# Attach metadata in the SAME shape as your rag_service.index_document
COURSE_ID = "db101"
for d in documents:
    d.metadata.update({
        "doc_id": "db_lecture_1",
        "doc_type": "pdf",            # same types as your backend: pdf, mindmap, quiz, ...
        "title": "Intro to Relational Databases",
        "course_id": COURSE_ID,
    })

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500 * 4,        # ≈500 tokens (LangChain measures chars, ~4 chars/token)
    chunk_overlap=50 * 4,      # ≈50 tokens
    separators=["\n\n", "\n", ". ", " "],
)
chunks = splitter.split_documents(documents)
print(f"Split into {len(chunks)} chunks")

# ─── 2. Embed and store in a PER-COURSE Chroma collection ───
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/text-embedding-004",   # Google's stable embedding model
    google_api_key=os.getenv("GOOGLE_API_KEY"),
)

vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    collection_name=f"course_{COURSE_ID}",       # same per-course naming convention
    persist_directory="./chroma_db",
    collection_metadata={"hnsw:space": "cosine"},
)

# ─── 3. Multi-step retrieval (mirrors rag_multistep.decompose_query) ───
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",                    # SMART_MODEL
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.3,
)
fast_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite",                # FAST_MODEL — same split as your ai_service.py
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.1,
)

# MultiQueryRetriever decomposes a question into 3 alternative phrasings
# and retrieves for each — equivalent to your decompose_query()
base_retriever = vectorstore.as_retriever(search_kwargs={"k": 20})   # over-fetch
multi_retriever = MultiQueryRetriever.from_llm(
    retriever=base_retriever,
    llm=fast_llm,
)

# ─── 4. Cross-encoder rerank (same BGE model as your rag_service._rerank) ───
print("Loading cross-encoder (~80 MB first time)...")
cross_encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
reranker = CrossEncoderReranker(model=cross_encoder, top_n=5)

# Pipe: over-fetch with multi-query → rerank to top 5
compression_retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=multi_retriever,
)

# ─── 5. Build a retrieval-augmented chain (same idea as your companion's chat) ───
prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are SmartBuddy, a friendly AI study companion. "
     "Use ONLY the retrieved course materials below to answer. "
     "Cite sources as [Source N]. If sources don't cover the question, say so.\n\n"
     "Retrieved sources:\n{context}"),
    ("human", "{input}"),
])

stuff_chain = create_stuff_documents_chain(llm, prompt)
rag_chain = create_retrieval_chain(compression_retriever, stuff_chain)

# ─── 6. Run a query and show the result + sources ───
question = "Compare ER and EER models and explain how normalisation relates to them"
print(f"\nQuestion: {question}\n")
result = rag_chain.invoke({"input": question})

print(f"Answer:\n{result['answer']}\n")
print(f"Sources used ({len(result['context'])} chunks):")
for i, doc in enumerate(result["context"], 1):
    print(f"  [{i}] {doc.metadata.get('title')} ({doc.metadata.get('doc_type')})")
    print(f"      \"{doc.page_content[:120]}...\"")
