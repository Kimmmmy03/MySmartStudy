$ bash start-backend.sh
start-backend.sh: line 1: a#!/usr/bin/env: No such file or directory
============================================
  MySmartStudy - Backend Server
============================================

[backend] Activated venv (Windows)
[backend] Installing dependencies...
hint: See above for details.
[backend] Starting FastAPI server...
[backend] API:     http://localhost:8000
[backend] Docs:    http://localhost:8000/docs
[backend] ReDoc:   http://localhost:8000/redoc

[backend] INFO:     Will watch for changes in these directories: ['C:\\Users\\ASUS\\Documents\\SEM 6\\FYP 2\\code\\MySmartStudy\\backend']
[backend] INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[backend] INFO:     Started reloader process [26532] using WatchFiles
[backend] Process SpawnProcess-1:
[backend] Traceback (most recent call last):
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\multiprocessing\process.py", line 313, in _bootstrap
[backend]     self.run()
[backend]     ~~~~~~~~^^
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\multiprocessing\process.py", line 108, in run
[backend]     self._target(*self._args, **self._kwargs)
[backend]     ~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\_subprocess.py", line 80, in subprocess_started
[backend]     target(sockets=sockets)
[backend]     ~~~~~~^^^^^^^^^^^^^^^^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\server.py", line 65, in run
[backend]     return asyncio.run(self.serve(sockets=sockets))
[backend]            ~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\asyncio\runners.py", line 195, in run
[backend]     return runner.run(main)
[backend]            ~~~~~~~~~~^^^^^^
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\asyncio\runners.py", line 118, in run
[backend]     return self._loop.run_until_complete(task)
[backend]            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\asyncio\base_events.py", line 725, in run_until_complete
[backend]     return future.result()
[backend]            ~~~~~~~~~~~~~^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\server.py", line 69, in serve
[backend]     await self._serve(sockets)
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\server.py", line 76, in _serve
[backend]     config.load()
[backend]     ~~~~~~~~~~~^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\config.py", line 434, in load
[backend]     self.loaded_app = import_from_string(self.app)
[backend]                       ~~~~~~~~~~~~~~~~~~^^^^^^^^^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\importer.py", line 22, in import_from_string
[backend]     raise exc from None
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\importer.py", line 19, in import_from_string
[backend]     module = importlib.import_module(module_str)
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\importlib\__init__.py", line 88, in import_module
[backend]     return _bootstrap._gcd_import(name[level:], package, level)
[backend]            ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
[backend]   File "<frozen importlib._bootstrap>", line 1387, in _gcd_import
[backend]   File "<frozen importlib._bootstrap>", line 1360, in _find_and_load
[backend]   File "<frozen importlib._bootstrap>", line 1331, in _find_and_load_unlocked
[backend]   File "<frozen importlib._bootstrap>", line 935, in _load_unlocked
[backend]   File "<frozen importlib._bootstrap_external>", line 1023, in exec_module
[backend]   File "<frozen importlib._bootstrap>", line 488, in _call_with_frames_removed
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\main.py", line 7, in <module>
[backend]     from app.routers import ai_plagiarism, ai_grading, ai_companion, ai_study_materials, ai_study_plan, ai_import, ai_images, ai_mindmap_buddy, rag_admin
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\app\routers\ai_plagiarism.py", line 8, in <module>
[backend]     from app import knowledge_graph_service, gag_service
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\app\knowledge_graph_service.py", line 16, in <module>
[backend]     from . import models, rag_service
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\app\rag_service.py", line 15, in <module>
[backend]     import chromadb
[backend] ModuleNotFoundError: No module named 'chromadb'

[stop] Shutting down backend...
[done] Backend stopped.

ASUS@ASUS-ROG MINGW64 ~/Documents/SEM 6/FYP 2/code/MySmartStudy
$ bash start-backend.sh
start-backend.sh: line 1: a#!/usr/bin/env: No such file or directory
============================================
  MySmartStudy - Backend Server
============================================

[backend] Activated venv (Windows)
[backend] Installing dependencies...
hint: See above for details.
[backend] Starting FastAPI server...
[backend] API:     http://localhost:8000
[backend] Docs:    http://localhost:8000/docs
[backend] ReDoc:   http://localhost:8000/redoc

[backend] INFO:     Will watch for changes in these directories: ['C:\\Users\\ASUS\\Documents\\SEM 6\\FYP 2\\code\\MySmartStudy\\backend']
[backend] INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[backend] INFO:     Started reloader process [18200] using WatchFiles
[backend] Process SpawnProcess-1:
[backend] Traceback (most recent call last):
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\multiprocessing\process.py", line 313, in _bootstrap
[backend]     self.run()
[backend]     ~~~~~~~~^^
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\multiprocessing\process.py", line 108, in run
[backend]     self._target(*self._args, **self._kwargs)
[backend]     ~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\_subprocess.py", line 80, in subprocess_started
[backend]     target(sockets=sockets)
[backend]     ~~~~~~^^^^^^^^^^^^^^^^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\server.py", line 65, in run
[backend]     return asyncio.run(self.serve(sockets=sockets))
[backend]            ~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\asyncio\runners.py", line 195, in run
[backend]     return runner.run(main)
[backend]            ~~~~~~~~~~^^^^^^
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\asyncio\runners.py", line 118, in run
[backend]     return self._loop.run_until_complete(task)
[backend]            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\asyncio\base_events.py", line 725, in run_until_complete
[backend]     return future.result()
[backend]            ~~~~~~~~~~~~~^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\server.py", line 69, in serve
[backend]     await self._serve(sockets)
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\server.py", line 76, in _serve
[backend]     config.load()
[backend]     ~~~~~~~~~~~^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\config.py", line 434, in load
[backend]     self.loaded_app = import_from_string(self.app)
[backend]                       ~~~~~~~~~~~~~~~~~~^^^^^^^^^^
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\importer.py", line 22, in import_from_string
[backend]     raise exc from None
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\venv\Lib\site-packages\uvicorn\importer.py", line 19, in import_from_string
[backend]     module = importlib.import_module(module_str)
[backend]   File "C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13_3.13.3312.0_x64__qbz5n2kfra8p0\Lib\importlib\__init__.py", line 88, in import_module
[backend]     return _bootstrap._gcd_import(name[level:], package, level)
[backend]            ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
[backend]   File "<frozen importlib._bootstrap>", line 1387, in _gcd_import
[backend]   File "<frozen importlib._bootstrap>", line 1360, in _find_and_load
[backend]   File "<frozen importlib._bootstrap>", line 1331, in _find_and_load_unlocked
[backend]   File "<frozen importlib._bootstrap>", line 935, in _load_unlocked
[backend]   File "<frozen importlib._bootstrap_external>", line 1023, in exec_module
[backend]   File "<frozen importlib._bootstrap>", line 488, in _call_with_frames_removed
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\main.py", line 7, in <module>
[backend]     from app.routers import ai_plagiarism, ai_grading, ai_companion, ai_study_materials, ai_study_plan, ai_import, ai_images, ai_mindmap_buddy, rag_admin
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\app\routers\ai_plagiarism.py", line 8, in <module>
[backend]     from app import knowledge_graph_service, gag_service
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\app\knowledge_graph_service.py", line 16, in <module>
[backend]     from . import models, rag_service
[backend]   File "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend\app\rag_service.py", line 15, in <module>
[backend]     import chromadb
[backend] ModuleNotFoundError: No module named 'chromadb'