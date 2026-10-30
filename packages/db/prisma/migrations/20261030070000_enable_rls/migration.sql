-- Supabase mở schema public qua REST API (PostgREST). Bật RLS không kèm policy để chặn mọi truy cập
-- qua API; ứng dụng kết nối bằng chủ sở hữu bảng nên không bị RLS giới hạn.
-- Bảng thêm sau này cũng cần bật RLS trong migration của chính nó.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
