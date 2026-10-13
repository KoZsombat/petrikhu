export default function Introduction() {
  return (
    <section className="px-4 py-20 bg-white w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:flex-row justify-evenly items-center md:max-w-4/6 mx-auto gap-10">
        <div className="md:w-1/2 aspect-video">
          <iframe
            className="w-full h-full rounded-lg"
            src="https://www.youtube.com/embed/NnanAwvV8FI"
            title="Aki Petrikes lesz…"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
        <div className="flex flex-col gap-5 md:w-1/2 text-center md:text-start">
          <h1 className="text-2xl font-bold italic font-serif">
            „Aki Petrikes lesz…”
          </h1>
          <p className="text-petrikfaint text-md">
            Rövid filmünkben diákok és tanárok mesélnek arról, milyen a
            mindennapi élet a Petriken – a laboroktól a terepgyakorlatokon át a
            közös projektekig.
          </p>
        </div>
      </div>
    </section>
  );
}
